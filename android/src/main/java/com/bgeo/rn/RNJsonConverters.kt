package com.bgeo.rn

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject

/**
 * RN bridge <-> engine value conversion. The engine speaks org.json only (no
 * React types); this file is the single place the two worlds meet and stays in
 * the OPEN bridge layer.
 */

fun ReadableMap.toJSONObject(): JSONObject {
  val obj = JSONObject()
  val it = keySetIterator()
  while (it.hasNextKey()) {
    val key = it.nextKey()
    when (getType(key)) {
      ReadableType.Null -> obj.put(key, JSONObject.NULL)
      ReadableType.Boolean -> obj.put(key, getBoolean(key))
      ReadableType.Number -> obj.put(key, getDouble(key))
      ReadableType.String -> obj.put(key, getString(key))
      ReadableType.Map -> getMap(key)?.let { m -> obj.put(key, m.toJSONObject()) }
      ReadableType.Array -> getArray(key)?.let { a -> obj.put(key, a.toJSONArray()) }
    }
  }
  return obj
}

fun ReadableArray.toJSONArray(): JSONArray {
  val out = JSONArray()
  for (i in 0 until size()) {
    when (getType(i)) {
      ReadableType.Null -> out.put(JSONObject.NULL)
      ReadableType.Boolean -> out.put(getBoolean(i))
      ReadableType.Number -> out.put(getDouble(i))
      ReadableType.String -> out.put(getString(i))
      ReadableType.Map -> getMap(i)?.let { m -> out.put(m.toJSONObject()) }
      ReadableType.Array -> getArray(i)?.let { a -> out.put(a.toJSONArray()) }
    }
  }
  return out
}

fun JSONObject.toWritableMap(): WritableMap {
  val map = Arguments.createMap()
  for (key in keys()) {
    when (val v = get(key)) {
      JSONObject.NULL -> map.putNull(key)
      is Boolean -> map.putBoolean(key, v)
      is Int -> map.putInt(key, v)
      is Long -> map.putDouble(key, v.toDouble())
      is Number -> map.putDouble(key, v.toDouble())
      is String -> map.putString(key, v)
      is JSONObject -> map.putMap(key, v.toWritableMap())
      is JSONArray -> map.putArray(key, v.toWritableArray())
    }
  }
  return map
}

fun JSONArray.toWritableArray(): WritableArray {
  val out = Arguments.createArray()
  for (i in 0 until length()) {
    when (val v = get(i)) {
      JSONObject.NULL -> out.pushNull()
      is Boolean -> out.pushBoolean(v)
      is Int -> out.pushInt(v)
      is Long -> out.pushDouble(v.toDouble())
      is Number -> out.pushDouble(v.toDouble())
      is String -> out.pushString(v)
      is JSONObject -> out.pushMap(v.toWritableMap())
      is JSONArray -> out.pushArray(v.toWritableArray())
    }
  }
  return out
}
