#pragma once

#include <audioapi/utils/AudioBuffer.hpp>

#include <cstddef>
#include <memory>

namespace audioapi {

/// Time-stretcher with the WSOLA class's original public surface, backed by
/// Signalsmith Stretch (phase-vocoder; MIT, vendored under ./signalsmith).
/// The time-domain WSOLA it replaces duplicated or dropped transients at any
/// rate away from 1 — audible as granular "stones" on polyphonic material.
class WsolaTimeStretcher {
 public:
  WsolaTimeStretcher();
  ~WsolaTimeStretcher();
  WsolaTimeStretcher(const WsolaTimeStretcher &) = delete;
  WsolaTimeStretcher &operator=(const WsolaTimeStretcher &) = delete;

  void configure(size_t channels, float sampleRate);
  void reset();

  [[nodiscard]] size_t getRequiredInputFrames() const;
  [[nodiscard]] size_t getBufferedInputFrames() const;
  [[nodiscard]] size_t getBufferedOutputFrames() const;

  void process(
      const DSPAudioBuffer &input,
      size_t inputFrames,
      DSPAudioBuffer &output,
      size_t outputFrames,
      float playbackRate,
      float pitchFactor = 1.0f);

  /// @brief Renders already-buffered stretcher output/input without appending new PCM.
  /// @return Number of frames written to @p output.
  size_t drainOutput(DSPAudioBuffer &output, size_t outputFrames, float playbackRate);

  // some arbitrary value has to be set here to limit the size of the buffer for the stretcher
  static constexpr float MAX_PLAYBACK_RATE = 4;

  /// Rough latency estimates for buffer tail padding (seconds). The phase
  /// vocoder's default preset is a 120ms analysis block: half a block of input
  /// latency and half a block of output latency.
  static constexpr float INPUT_LATENCY_MS = 60.0f;
  static constexpr float OUTPUT_LATENCY_MS = 60.0f;

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace audioapi
