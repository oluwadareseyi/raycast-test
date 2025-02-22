

#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

varying vec3 vWorldNormal;

uniform vec2 bugsSize;
uniform vec4 bugsParams;
uniform float time;

uniform sampler2D heightmap;
uniform vec3 heightmapParams;

attribute vec3 offset;


float inverseLerp(float minValue, float maxValue, float v) {
  return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(inMin, inMax, v);
  return mix(outMin, outMax, t);
}

mat3 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(c, 0, s),
        vec3(0, 1, 0),
        vec3(-s, 0, c)
    );
}

uint murmurHash11(uint src) {
  const uint M = 0x5bd1e995u;
  uint h = 1190494759u;
  src *= M; src ^= src>>24u; src *= M;
  h *= M; h ^= src;
  h ^= h>>13u; h *= M; h ^= h>>15u;
  return h;
}

uvec4 murmurHash42(uvec2 src) {
    const uint M = 0x5bd1e995u;
    uvec4 h = uvec4(1190494759u, 2147483647u, 3559788179u, 179424673u);
    src *= M; src ^= src>>24u; src *= M;
    h *= M; h ^= src.x; h *= M; h ^= src.y;
    h ^= h>>13u; h *= M; h ^= h>>15u;
    return h;
}

// 4 outputs, 2 inputs
vec4 hash42(vec2 src) {
  uvec4 h = murmurHash42(floatBitsToUint(src));
  return uintBitsToFloat(h & 0x007fffffu | 0x3f800000u) - 1.0;
}


float hash11(float src) {
  uint h = murmurHash11(floatBitsToUint(src));
  return uintBitsToFloat(h & 0x007fffffu | 0x3f800000u) - 1.0;
}

float noise11(float p) {
  float i = floor(p);

  float f = fract(p);
  float u = smoothstep(0.0, 1.0, f);

	float val = mix( hash11(i + 0.0),
                   hash11(i + 1.0), u);
  return val * 2.0 - 1.0;
}

void main() {
  #include <uv_vertex>
  #include <color_vertex>
  #include <morphcolor_vertex>
  // #include <beginnormal_vertex>

  vec3 objectNormal = vec3(0.0, 1.0, 0.0);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif

  // #include <begin_vertex>

vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif

  vec4 bugHashVal = hash42(offset.xz);

  float BUG_SCALE = mix(0.35, 0.55, bugHashVal.z);
  transformed *= BUG_SCALE;

  const float FLAP_SPEED = 20.0;
  float flapTimeSample = time * FLAP_SPEED + bugHashVal.x * 100.0;
  transformed.y += mix(0.0, sin(flapTimeSample), abs(position.x)) * BUG_SCALE;
  transformed.x *= abs(cos(flapTimeSample));

  float TIME_PERIOD = 20.0;
  float repeatingTime = TIME_PERIOD * 0.5 - abs(mod(time, TIME_PERIOD) - TIME_PERIOD * 0.5);

  float height = noise11(time * 3.0 + bugHashVal.x * 100.0);
  // transformed.y += height * 0.5;

  // Loop
  float loopTime = time * 0.5 + bugHashVal.x * 123.23;
  float loopSize = 2.0;
  vec3 bugsOffset = vec3(sin(loopTime) * loopSize, height * 0.125, cos(loopTime) * loopSize) + offset;

  // Forward
  transformed = rotateY(-loopTime + PI / 2.0) * transformed;
  transformed += bugsOffset;

  // Center
  vec3 bugCenter = offset;

  vec3 bugsWorldPos = (modelMatrix * vec4(bugCenter, 1.0)).xyz;
  vec2 heightmapUV = vec2(
      remap(bugsWorldPos.x, -heightmapParams.z * 0.5, heightmapParams.z * 0.5, 0.0, 1.0),
      remap(bugsWorldPos.z, -heightmapParams.z * 0.5, heightmapParams.z * 0.5, 1.0, 0.0));
  float terrainHeight = texture2D(heightmap, heightmapUV).x * heightmapParams.x - heightmapParams.y;
  transformed.y += terrainHeight;

  if (terrainHeight < -11.0) {
    transformed.y -= 1000.0;
  }

  objectNormal = normal;

  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <normal_vertex>

  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>

  // #include <project_vertex>
  vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;

  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = - mvPosition.xyz;
  #include <worldpos_vertex>
  #include <envmap_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>

  vWorldNormal = (modelMatrix * vec4(normal.xyz, 0.0)).xyz;
}