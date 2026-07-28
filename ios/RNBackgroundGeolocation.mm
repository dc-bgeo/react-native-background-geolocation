#import "RNBackgroundGeolocation.h"
#import <BGeoCore/BGGeoEngine.h>
#import <BGeoCore/BGGeoLogger.h>

/**
 * Codegen TurboModule glue. Promise methods forward to the process-singleton
 * `BGGeoEngine` (Objective-C) for the CoreLocation work; lifecycle/permission/
 * geofencing methods are still stubbed and land in later phases.
 */
@implementation RNBackgroundGeolocation {
  // The codegen emit* methods call the protected `_eventEmitterCallback`
  // std::function, which the runtime installs via setEventEmitterCallback:
  // some time AFTER init. The engine can emit earlier (e.g. CoreLocation's
  // initial didChangeAuthorization fires during app launch) — calling an empty
  // std::function aborts with bad_function_call. Buffer until the emitter is
  // wired, then flush in order.
  BOOL _emitterReady;
  NSMutableArray<NSArray *> *_pendingEvents;
}

RCT_EXPORT_MODULE()

// All CoreLocation work and every NSTimer in BGGeoEngine (heartbeat, watch, the
// motion stop/trigger countdowns, the one-shot timeout, the permission watchdog)
// must run on a thread with a live run loop. TurboModule methods otherwise land
// on a background dispatch queue whose worker threads have no run loop — there
// scheduled timers never fire and CLLocationManager delegate callbacks are never
// delivered. Pin the whole module to the main queue so the engine always
// schedules/starts on the main run loop (and delegate callbacks come back there).
- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

// Module creation (init -> first [BGGeoEngine shared]) must happen on the main
// thread: the engine's +shared dispatch_syncs to main otherwise, and RN only
// guarantees main-queue creation via a deprecated custom-init fallback
// (TODO(T65864302) in RCTTurboModuleManager). Make the guarantee explicit.
+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (instancetype)init
{
  if (self = [super init]) {
    __weak RNBackgroundGeolocation *weakSelf = self;
    [BGGeoEngine shared].eventEmitter = ^(NSString *name, NSDictionary *body) {
      [weakSelf dispatchEvent:name body:body];
    };
  }
  return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBackgroundGeolocationSpecJSI>(params);
}

#pragma mark - Event dispatch

- (void)setEventEmitterCallback:(EventEmitterCallbackWrapper *)wrapper
{
  [super setEventEmitterCallback:wrapper];
  NSArray<NSArray *> *queued;
  @synchronized(self) {
    _emitterReady = YES;
    queued = [_pendingEvents copy];
    _pendingEvents = nil;
  }
  for (NSArray *event in queued) {
    [self dispatchEvent:event[0] body:event[1]];
  }
}

- (void)dispatchEvent:(NSString *)name body:(NSDictionary *)body
{
  @synchronized(self) {
    if (!_emitterReady) {
      _pendingEvents = _pendingEvents ?: [NSMutableArray array];
      if (_pendingEvents.count < 64) {
        [_pendingEvents addObject:@[name, body ?: @{}]];
      }
      return;
    }
  }
  if ([name isEqualToString:@"location"]) {
    [self emitOnLocation:body];
  } else if ([name isEqualToString:@"locationerror"]) {
    [self emitOnLocationError:body];
  } else if ([name isEqualToString:@"providerchange"]) {
    [self emitOnProviderChange:body];
  } else if ([name isEqualToString:@"heartbeat"]) {
    [self emitOnHeartbeat:body];
  } else if ([name isEqualToString:@"motionchange"]) {
    [self emitOnMotionChange:body];
  } else if ([name isEqualToString:@"geofence"]) {
    [self emitOnGeofence:body];
  } else if ([name isEqualToString:@"geofenceschange"]) {
    [self emitOnGeofencesChange:body];
  } else if ([name isEqualToString:@"authorization"]) {
    [self emitOnAuthorization:body];
  } else if ([name isEqualToString:@"powersavechange"]) {
    [self emitOnPowerSaveChange:body];
  } else if ([name isEqualToString:@"http"]) {
    [self emitOnHttp:body];
  } else if ([name isEqualToString:@"connectivitychange"]) {
    [self emitOnConnectivityChange:body];
  }
}

#pragma mark - Lifecycle

- (void)ready:(NSDictionary *)config
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  BGGeoEngine *engine = [BGGeoEngine shared];
  [engine applyConfig:config];
  NSString *licenseError = [engine licenseErrorCode];
  if (licenseError) {
    reject(licenseError, [NSString stringWithFormat:@"BGeo license check failed (%@)", licenseError], nil);
    return;
  }
  resolve([engine stateDictionary]);
}

- (void)setConfig:(NSDictionary *)config
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  BGGeoEngine *engine = [BGGeoEngine shared];
  [engine applyConfig:config];
  resolve([engine stateDictionary]);
}

- (void)start:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  BGGeoEngine *engine = [BGGeoEngine shared];
  NSString *licenseError = [engine licenseErrorCode];
  if (licenseError) {
    reject(licenseError, [NSString stringWithFormat:@"BGeo license check failed (%@)", licenseError], nil);
    return;
  }
  [engine startTracking];
  resolve([engine stateDictionary]);
}

- (void)stop:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  BGGeoEngine *engine = [BGGeoEngine shared];
  [engine stopTracking];
  resolve([engine stateDictionary]);
}

- (void)getState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([[BGGeoEngine shared] stateDictionary]);
}

- (void)changePace:(BOOL)isMoving
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  if ([[BGGeoEngine shared] changePace:isMoving]) {
    resolve(nil);
  } else {
    reject(@"DISABLED", @"Cannot changePace while tracking is disabled", nil);
  }
}

#pragma mark - Single-shot / watch

- (void)getCurrentPosition:(NSDictionary *)options
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] getCurrentPosition:options
                                  resolve:^(NSDictionary *location) { resolve(location); }
                                   reject:^(NSString *code, NSString *message) {
                                     reject(code, message, nil);
                                   }];
}

- (void)watchPosition:(NSDictionary *)options
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] startWatch:options];
  resolve(nil);
}

- (void)stopWatchPosition:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] stopWatch];
  resolve(nil);
}

#pragma mark - Permission / provider

- (void)requestPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] requestPermission:^(NSInteger status) { resolve(@(status)); }
                                  reject:^(NSString *code, NSString *message) {
                                    reject(code, message, nil);
                                  }];
}

- (void)requestTemporaryFullAccuracy:(NSString *)purpose
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] requestTemporaryFullAccuracy:purpose
                                          completion:^(NSInteger accuracy) { resolve(@(accuracy)); }];
}

- (void)getProviderState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([[BGGeoEngine shared] providerState]);
}

- (void)isPowerSaveMode:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[BGGeoEngine shared] isPowerSaveMode]));
}

#pragma mark - Odometer

- (void)getOdometer:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[BGGeoEngine shared] odometer]));
}

- (void)setOdometer:(double)value
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] setOdometer:value
                           resolve:^(NSDictionary *location) { resolve(location); }
                            reject:^(NSString *code, NSString *message) {
                              reject(code, message, nil);
                            }];
}

#pragma mark - Upload queue

- (void)sync:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([[BGGeoEngine shared] syncQueue]);
}

- (void)getLocations:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([[BGGeoEngine shared] queuedLocations]);
}

- (void)destroyLocations:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([[BGGeoEngine shared] destroyQueuedLocations]);
}

- (void)getCount:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[BGGeoEngine shared] pendingQueueCount]));
}

- (void)destroyLocation:(NSString *)uuid
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  if ([[BGGeoEngine shared] destroyQueuedLocation:uuid]) {
    resolve(nil);
  } else {
    reject(@"NOT_FOUND", [NSString stringWithFormat:@"No queued location with uuid %@", uuid], nil);
  }
}

- (void)insertLocation:(NSDictionary *)location
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] insertQueuedLocation:location];
  resolve(nil);
}

#pragma mark - Auth

- (void)getAuthState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([[BGGeoEngine shared] authStateDictionary]);
}

#pragma mark - Logger

- (void)log:(double)level
      event:(NSString *)event
    message:(NSString *)message
   dataJson:(NSString *)dataJson
        tag:(NSString *)tag
    resolve:(RCTPromiseResolveBlock)resolve
     reject:(RCTPromiseRejectBlock)reject
{
  // `tag` is the Android logcat category — the iOS engine's BGGeoLogger has no
  // such parameter (os_log carries its own subsystem/category), so it is
  // accepted for a single JS surface and deliberately ignored here.
  (void)tag;
  [BGGeoLogger log:(NSInteger)level
             event:(event.length ? event : @"app")
           message:(message.length ? message : nil)
              data:(dataJson.length ? dataJson : nil)
               src:@"js"];
  resolve(nil);
}

- (void)getLog:(double)limit resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSInteger capped = MAX(1, MIN((NSInteger)limit, 5000));
  resolve(@{ @"entries": [[BGGeoEngine shared] logEntries:capped] });
}

- (void)destroyLog:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[BGGeoEngine shared] destroyLogs]));
}

- (void)uploadLog:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSInteger pending = [[BGGeoEngine shared] pendingLogCount];
  [[BGGeoEngine shared] flushLogs];
  resolve(@(pending));
}

#pragma mark - Geofences

- (void)addGeofence:(NSDictionary *)geofence
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  if (geofence == nil) {
    reject(@"INVALID_GEOFENCE", @"expected {geofences: [...]}", nil);
    return;
  }
  [self addGeofences:@{ @"geofences": @[ geofence ] } resolve:resolve reject:reject];
}

- (void)addGeofences:(NSDictionary *)geofences
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  // Codegen maps the spec's `UnsafeObject` param to NSDictionary (not NSArray) on
  // iOS; mirror getGeofences()'s {"geofences":[...]} shape on the way in.
  if (![geofences[@"geofences"] isKindOfClass:[NSArray class]]) {
    reject(@"INVALID_GEOFENCE", @"expected {geofences: [...]}", nil);
    return;
  }
  NSArray *list = geofences[@"geofences"];
  // The engine gates the license (returns the LICENSE_* code as the error string).
  NSString *error = [[BGGeoEngine shared] addGeofences:list];
  if (error) {
    reject(error, [NSString stringWithFormat:@"geofence request rejected (%@)", error], nil);
    return;
  }
  resolve(nil);
}

- (void)removeGeofence:(NSString *)identifier
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] removeGeofence:identifier];
  resolve(nil);
}

- (void)removeGeofences:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[BGGeoEngine shared] removeAllGeofences];
  resolve(nil);
}

- (void)getGeofences:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@{ @"geofences": [[BGGeoEngine shared] geofences] });
}

- (void)geofenceExists:(NSString *)identifier
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[BGGeoEngine shared] geofenceExists:identifier]));
}

@end
