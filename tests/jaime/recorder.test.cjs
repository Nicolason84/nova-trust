'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {create} = require('../../docs/jaime/recorder.js');

class Events {
  constructor() { this.events = new Map(); }
  addEventListener(name, fn) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(fn); }
  removeEventListener(name, fn) { this.events.get(name)?.delete(fn); }
  emit(name, event = {}) { for (const fn of [...(this.events.get(name) || [])]) fn(event); }
  listenerCount() { return [...this.events.values()].reduce((n, entries) => n + entries.size, 0); }
}
class Clock {
  constructor() { this.time = 1000; this.next = 0; this.jobs = new Map(); }
  add(fn, delay, interval = false) { const id = ++this.next; this.jobs.set(id, {fn, time: this.time + delay, interval: interval ? delay : 0}); return id; }
  advance(ms) {
    const end = this.time + ms;
    for (;;) {
      const next = [...this.jobs].filter(([, job]) => job.time <= end).sort((a, b) => a[1].time - b[1].time || a[0] - b[0])[0];
      if (!next) break;
      const [id, job] = next; this.time = job.time;
      if (job.interval) job.time += job.interval; else this.jobs.delete(id);
      job.fn();
    }
    this.time = end;
  }
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function makeStream() {
  const track = new Events(); track.readyState = 'live'; track.stops = 0;
  track.stop = () => { track.stops++; track.readyState = 'ended'; };
  return {track, getTracks: () => [track], getAudioTracks: () => [track]};
}
function fixture(config = {}, options = {}) {
  const clock = new Clock(), stream = makeStream(), document = new Events(), window = new Events();
  document.visibilityState = 'visible';
  const audio = [], errors = [], states = [], instances = [], requests = [];
  class Recorder extends Events {
    static isTypeSupported(type) { return (config.supported || ['audio/mp4']).includes(type); }
    constructor(inputStream, init = {}) {
      super();
      if (config.constructError) throw Object.assign(new Error('constructor'), {name: config.constructError});
      if (config.rejectExplicitType && init.mimeType) throw Object.assign(new Error('format'), {name: 'NotSupportedError'});
      this.stream = inputStream; this.options = init; this.mimeType = init.mimeType || config.defaultMime || 'audio/mp4';
      this.state = 'inactive'; this.stops = 0; instances.push(this);
    }
    start() { if (config.startError) throw new Error('start failed'); this.state = 'recording'; }
    stop() {
      this.stops++; this.state = 'inactive';
      if (config.stopError) throw new Error('stop failed');
      if (config.noStopEvent) return;
      clock.add(() => {
        this.emit('dataavailable', {data: new Blob([config.finalData === undefined ? 'final' : config.finalData], {type: this.mimeType})});
        this.emit('stop');
      }, 0);
    }
  }
  if (config.noTypeDetection) delete Recorder.isTypeSupported;
  const env = {
    mediaDevices: {getUserMedia: constraints => { requests.push(constraints); return config.permission ? config.permission.promise : Promise.resolve(stream); }},
    MediaRecorder: Recorder, Blob, isSecureContext: true,
    now: () => clock.time,
    setTimeout: (fn, ms) => clock.add(fn, ms), clearTimeout: id => clock.jobs.delete(id),
    setInterval: (fn, ms) => clock.add(fn, ms, true), clearInterval: id => clock.jobs.delete(id),
    document, lifecycleTarget: window
  };
  const controller = create({permissionTimeoutMs: 200, stopTimeoutMs: 50, onAudio: result => audio.push(result), onError: result => errors.push(result), onState: result => states.push(result), ...options, env: {...env, ...options.env}});
  return {controller, clock, stream, audio, errors, states, instances, requests, document, window};
}

test('completed audio contains final chunk, belongs to original topic, releases microphone before delivery', async () => {
  const f = fixture();
  assert.equal(await f.controller.start({contextId: 'topic-a'}), true);
  assert.deepEqual(f.requests, [{audio: true, video: false}]);
  assert.equal(f.instances[0].options.mimeType, 'audio/mp4');
  f.instances[0].emit('dataavailable', {data: new Blob(['first-'], {type: 'audio/mp4'})});
  f.clock.advance(1000); f.controller.stop();
  assert.equal(f.stream.track.stops, 1); assert.equal(f.audio.length, 0);
  assert.equal(f.controller.getSnapshot().state, 'stopping');
  f.clock.advance(0);
  assert.equal(f.audio.length, 1); assert.equal(await f.audio[0].blob.text(), 'first-final');
  assert.equal(f.audio[0].contextId, 'topic-a'); assert.equal(f.audio[0].durationMs, 1000);
  assert.equal(f.audio[0].interrupted, false); assert.equal(f.audio[0].requiresReview, true);
  assert.match(f.audio[0].filename, /\.m4a$/);
  assert.equal(f.controller.getSnapshot().canStart, true); assert.equal(f.clock.jobs.size, 0);
  assert.equal(f.stream.track.listenerCount(), 0); assert.equal(f.instances[0].listenerCount(), 0);
});

test('refused permission is actionable and clears the pending request for retry', async () => {
  const permission = deferred(), f = fixture({permission});
  const start = f.controller.start({contextId: 'a'});
  permission.reject({name: 'NotAllowedError'});
  assert.equal(await start, false);
  assert.equal(f.controller.getSnapshot().canStart, true);
  assert.equal(f.errors[0].code, 'PERMISSION_DENIED'); assert.match(f.errors[0].message, /permiso/);
  assert.equal(f.clock.jobs.size, 0); assert.equal(f.audio.length, 0);
});

test('canceling pending permission prevents a late grant from recording; no second prompt is opened', async () => {
  const permission = deferred(), f = fixture({permission});
  const start = f.controller.start({contextId: 'a'});
  assert.equal(await f.controller.start({contextId: 'b'}), false);
  f.controller.cancel();
  assert.equal(await start, false);
  assert.equal(f.controller.getSnapshot().isBusy, false);
  assert.equal(f.controller.getSnapshot().permissionPending, true);
  assert.equal(await f.controller.start({contextId: 'b'}), false); assert.equal(f.requests.length, 1);
  permission.resolve(f.stream); await flush();
  assert.equal(f.stream.track.stops, 1); assert.equal(f.instances.length, 0);
  assert.equal(f.audio.length, 0); assert.equal(f.controller.getSnapshot().canStart, true);
});

test('unanswered permission has a finite UI wait and still closes a late stream', async () => {
  const permission = deferred(), f = fixture({permission});
  const start = f.controller.start({contextId: 'a'}); f.clock.advance(200);
  assert.equal(await start, false); assert.equal(f.errors[0].code, 'PERMISSION_TIMEOUT');
  assert.equal(f.controller.getSnapshot().isBusy, false); assert.equal(f.clock.jobs.size, 0);
  permission.resolve(f.stream); await flush(); assert.equal(f.stream.track.stops, 1);
});

test('constructor and start failures always close the acquired stream', async t => {
  for (const config of [{constructError: 'UnknownError'}, {startError: true}]) {
    await t.test(JSON.stringify(config), async () => {
      const f = fixture(config); assert.equal(await f.controller.start({contextId: 'a'}), false);
      assert.equal(f.stream.track.stops, 1); assert.equal(f.errors[0].code, 'START_FAILED');
      f.clock.advance(0); assert.equal(f.clock.jobs.size, 0); assert.equal(f.audio.length, 0);
      assert.equal(f.controller.getSnapshot().canStart, true);
    });
  }
});

test('format support is detected at runtime, with browser-default fallback', async t => {
  for (const config of [{noTypeDetection: true}, {supported: ['audio/webm;codecs=opus']}, {rejectExplicitType: true}]) {
    await t.test(JSON.stringify(config), async () => {
      const f = fixture(config); assert.equal(await f.controller.start({contextId: 'a'}), true);
      f.controller.stop(); f.clock.advance(0);
      assert.equal(f.audio.length, 1); assert.equal(f.errors.length, 0);
      if (config.supported) assert.match(f.audio[0].filename, /\.webm$/);
      else assert.equal(f.instances[0].options.mimeType, undefined);
    });
  }
});

test('empty audio and missing final stop cannot become successful attachments', async t => {
  for (const [config, code, advance] of [[{finalData: ''}, 'EMPTY_RECORDING', 0], [{noStopEvent: true}, 'FINALIZATION_TIMEOUT', 50], [{stopError: true}, 'FINALIZATION_FAILED', 0]]) {
    await t.test(code, async () => {
      const f = fixture(config); await f.controller.start({contextId: 'a'}); f.controller.stop(); f.clock.advance(advance);
      assert.equal(f.audio.length, 0); assert.equal(f.errors[0].code, code);
      assert.equal(f.stream.track.stops, 1); assert.equal(f.clock.jobs.size, 0);
      assert.equal(f.controller.getSnapshot().canStart, true);
    });
  }
});

test('microphone interruption preserves a completed container and marks it for review', async t => {
  for (const event of ['mute', 'ended']) {
    await t.test(event, async () => {
      const f = fixture(); await f.controller.start({contextId: 'a'});
      f.stream.track.emit(event); f.clock.advance(0);
      assert.equal(f.audio.length, 1); assert.equal(f.audio[0].interrupted, true);
      assert.equal(f.audio[0].contextId, 'a'); assert.equal(f.stream.track.stops, 1);
    });
  }
});

test('changing topic finishes into the original topic; a pending request is canceled', async () => {
  const f = fixture(); await f.controller.start({contextId: 'a'});
  f.controller.contextChanged('b'); f.clock.advance(0);
  assert.equal(f.audio[0].contextId, 'a'); assert.equal(f.audio[0].reason, 'context-changed');
  const permission = deferred(), g = fixture({permission});
  const start = g.controller.start({contextId: 'a'}); g.controller.contextChanged('b');
  assert.equal(await start, false); permission.resolve(g.stream); await flush();
  assert.equal(g.stream.track.stops, 1); assert.equal(g.audio.length, 0);
});

test('hiding the page stops recording without claiming an analysis; disposal removes lifecycle hooks', async () => {
  const f = fixture(); await f.controller.start({contextId: 'a'});
  f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); f.clock.advance(0);
  assert.equal(f.audio[0].reason, 'page-hidden'); assert.equal(f.audio[0].requiresReview, true);
  f.controller.dispose();
  assert.equal(f.window.listenerCount(), 0); assert.equal(f.document.listenerCount(), 0);
  assert.equal(f.controller.getSnapshot().state, 'disposed');
  assert.equal(await f.controller.start({contextId: 'a'}), false);
});

test('dispose during a permission prompt closes the late stream without any later callback', async () => {
  const permission = deferred(), f = fixture({permission});
  const start = f.controller.start({contextId: 'a'}); f.controller.dispose(); const stateCount = f.states.length;
  assert.equal(await start, false); permission.resolve(f.stream); await flush();
  assert.equal(f.stream.track.stops, 1); assert.equal(f.states.length, stateCount);
  assert.equal(f.errors.length, 0); assert.equal(f.audio.length, 0);
});

test('duration and size limits finalize whole containers; oversized final audio is rejected', async () => {
  const time = fixture({}, {maxDurationMs: 100}); await time.controller.start({contextId: 'a'}); time.clock.advance(100);
  assert.equal(time.audio[0].reason, 'duration-limit'); assert.equal(time.audio[0].durationMs, 100);
  const size = fixture({finalData: '12345'}, {maxBytes: 100}); await size.controller.start({contextId: 'a'});
  size.instances[0].emit('dataavailable', {data: new Blob(['x'.repeat(95)])}); size.clock.advance(0);
  assert.equal(size.audio[0].blob.size, 100); assert.equal(size.audio[0].reason, 'size-limit');
  const large = fixture({finalData: '123456'}, {maxBytes: 100}); await large.controller.start({contextId: 'a'});
  large.instances[0].emit('dataavailable', {data: new Blob(['x'.repeat(95)])}); large.clock.advance(0);
  assert.equal(large.audio.length, 0); assert.equal(large.errors[0].code, 'TOO_LARGE');
  assert.equal(large.stream.track.stops, 1);
});

test('recorder errors can yield reviewable partial audio, but revoked access is discarded', async () => {
  const f = fixture(); await f.controller.start({contextId: 'a'});
  f.instances[0].emit('error', {error: {name: 'UnknownError'}}); f.clock.advance(0);
  assert.equal(f.audio[0].interrupted, true); assert.equal(f.audio[0].reason, 'recorder-error');
  const g = fixture(); await g.controller.start({contextId: 'a'});
  g.instances[0].emit('error', {error: {name: 'SecurityError'}}); g.clock.advance(0);
  assert.equal(g.audio.length, 0); assert.equal(g.errors[0].code, 'CAPTURE_REVOKED'); assert.equal(g.stream.track.stops, 1);
});

test('unavailable or insecure environments never ask for microphone permission', async () => {
  for (const env of [{isSecureContext: false}, {MediaRecorder: undefined}, {mediaDevices: undefined}]) {
    const f = fixture({}, {env}); assert.equal(await f.controller.start({contextId: 'a'}), false);
    assert.equal(f.requests.length, 0); assert.equal(f.errors.length, 1);
  }
});

test('a failed asynchronous attachment handoff is explicit and cannot retain the microphone', async () => {
  const f = fixture({}, {onAudio: async () => { throw new Error('storage full'); }});
  await f.controller.start({contextId: 'a'}); f.controller.stop(); f.clock.advance(0); await flush();
  assert.equal(f.errors[0].code, 'HANDOFF_FAILED'); assert.equal(f.errors[0].audio.blob.size, 5);
  assert.equal(f.stream.track.stops, 1); assert.equal(f.controller.getSnapshot().canStart, true);
});
