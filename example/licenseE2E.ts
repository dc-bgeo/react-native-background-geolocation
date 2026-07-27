// License-gate integration check. The license is set ONLY in the app manifest
// (AndroidManifest <meta-data com.bgeo.license> / iOS Info.plist BGeoLicense) —
// there is no config license key. The full parse/verify/binding/policy logic is
// unit-tested on the host (core/filter-tests: Ed25519 + LicenseToken +
// LicensePolicy) and via the iOS Swift verifier test; this on-device check just
// confirms the manifest key is read and the gate lets a valid license through.
//
// The example ships a valid prod token in its AndroidManifest, so in a release
// build (DEBUG=false) ready() must resolve. Baseline without a manifest token is
// LICENSE_MISSING. Grep logs for "[MANIFEST]".
import BackgroundGeolocation from '@bgeo/react-native-background-geolocation';

export async function runManifestCheck(onLine?: (s: string) => void): Promise<void> {
  const log = (s: string) => {
    console.log(`[MANIFEST] ${s}`);
    onLine?.(`MANIFEST ${s}`);
  };
  let verdict = 'OK';
  try {
    await BackgroundGeolocation.ready({ distanceFilter: 50 });
  } catch (e: any) {
    verdict = e?.code ?? String(e);
  }
  log(`ready() -> ${verdict} (DEBUG=${__DEV__})`);
}
