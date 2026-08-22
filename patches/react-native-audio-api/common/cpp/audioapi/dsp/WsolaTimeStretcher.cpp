#include <audioapi/dsp/WsolaTimeStretcher.h>

#include "./signalsmith/signalsmith-stretch.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace audioapi {

struct WsolaTimeStretcher::Impl {
  signalsmith::stretch::SignalsmithStretch<float> stretch;

  size_t channels{0};
  float sampleRate{0.0f};
  float lastPitchFactor{1.0f};

  // Input the node has handed over but the stretcher has not consumed yet.
  // The node tops this up to getRequiredInputFrames() ahead of the read
  // position (its warm-up logic), which is what feeds the end-of-stream drain.
  std::vector<std::vector<float>> inputQueue;
  // Fractional input frames owed from previous quanta (rate * quantum is not
  // always an integer).
  double inputCarry{0.0};

  // End-of-stream tail, materialized on the first drainOutput() call.
  std::vector<std::vector<float>> drainBuffer;
  size_t drainReadIndex{0};
  bool drained{false};

  std::vector<const float *> inPtrs;
  std::vector<float *> outPtrs;

  void resetState() {
    stretch.reset();
    for (auto &q : inputQueue) {
      q.clear();
    }
    inputCarry = 0.0;
    drainBuffer.clear();
    drainReadIndex = 0;
    drained = false;
    lastPitchFactor = 1.0f;
    stretch.setTransposeFactor(1.0f);
  }
};

WsolaTimeStretcher::WsolaTimeStretcher() : impl_(std::make_unique<Impl>()) {}
WsolaTimeStretcher::~WsolaTimeStretcher() = default;

void WsolaTimeStretcher::configure(size_t channels, float sampleRate) {
  impl_->channels = channels;
  impl_->sampleRate = sampleRate > 0.0f ? sampleRate : 44100.0f;
  impl_->stretch.presetDefault(static_cast<int>(channels), impl_->sampleRate);
  impl_->inputQueue.assign(channels, {});
  impl_->inPtrs.assign(channels, nullptr);
  impl_->outPtrs.assign(channels, nullptr);
  impl_->resetState();
}

void WsolaTimeStretcher::reset() {
  impl_->resetState();
}

size_t WsolaTimeStretcher::getRequiredInputFrames() const {
  return impl_->channels == 0 ? 0 : static_cast<size_t>(impl_->stretch.inputLatency());
}

size_t WsolaTimeStretcher::getBufferedInputFrames() const {
  return impl_->inputQueue.empty() ? 0 : impl_->inputQueue[0].size();
}

size_t WsolaTimeStretcher::getBufferedOutputFrames() const {
  if (impl_->drainBuffer.empty()) {
    return 0;
  }
  return impl_->drainBuffer[0].size() - impl_->drainReadIndex;
}

void WsolaTimeStretcher::process(
    const DSPAudioBuffer &input,
    size_t inputFrames,
    DSPAudioBuffer &output,
    size_t outputFrames,
    float playbackRate,
    float pitchFactor) {
  output.zero();

  auto &impl = *impl_;
  if (impl.channels == 0 || playbackRate <= 0.0f || outputFrames == 0) {
    return;
  }

  const float pitch = pitchFactor > 0.0f ? pitchFactor : 1.0f;
  if (pitch != impl.lastPitchFactor) {
    impl.stretch.setTransposeFactor(pitch);
    impl.lastPitchFactor = pitch;
  }

  // Queue the newly delivered PCM.
  const size_t frames = std::min(inputFrames, input.getSize());
  for (size_t channel = 0; channel < impl.channels; ++channel) {
    const float *source = input.getChannel(channel)->begin();
    auto &queue = impl.inputQueue[channel];
    queue.insert(queue.end(), source, source + frames);
  }

  // Consume playbackRate input frames per output frame, carrying the fraction.
  const double want = static_cast<double>(playbackRate) * static_cast<double>(outputFrames) +
      impl.inputCarry;
  const auto wholeWant = static_cast<size_t>(want);
  const size_t available = impl.inputQueue[0].size();
  const size_t consume = std::min(wholeWant, available);
  // Only carry the sub-frame remainder; a shortfall against `available` is the
  // node under-delivering, and the stretcher re-times what it was given rather
  // than owing the deficit forever.
  impl.inputCarry = consume == wholeWant ? want - static_cast<double>(wholeWant) : 0.0;

  for (size_t channel = 0; channel < impl.channels; ++channel) {
    impl.inPtrs[channel] = impl.inputQueue[channel].data();
    impl.outPtrs[channel] = output.getChannel(channel)->begin();
  }

  impl.stretch.process(
      impl.inPtrs, static_cast<int>(consume), impl.outPtrs, static_cast<int>(outputFrames));

  for (auto &queue : impl.inputQueue) {
    queue.erase(queue.begin(), queue.begin() + static_cast<std::ptrdiff_t>(consume));
  }
}

size_t
WsolaTimeStretcher::drainOutput(DSPAudioBuffer &output, size_t outputFrames, float playbackRate) {
  auto &impl = *impl_;
  if (impl.channels == 0 || playbackRate <= 0.0f || outputFrames == 0) {
    return 0;
  }

  if (!impl.drained) {
    impl.drained = true;
    const size_t queued = impl.inputQueue.empty() ? 0 : impl.inputQueue[0].size();
    const auto queuedOut =
        static_cast<size_t>(std::floor(static_cast<double>(queued) / playbackRate));
    const auto flushOut = static_cast<size_t>(impl.stretch.outputLatency());
    const size_t total = queuedOut + flushOut;

    impl.drainBuffer.assign(impl.channels, std::vector<float>(total, 0.0f));
    impl.drainReadIndex = 0;

    if (queuedOut > 0) {
      for (size_t channel = 0; channel < impl.channels; ++channel) {
        impl.inPtrs[channel] = impl.inputQueue[channel].data();
        impl.outPtrs[channel] = impl.drainBuffer[channel].data();
      }
      impl.stretch.process(
          impl.inPtrs, static_cast<int>(queued), impl.outPtrs, static_cast<int>(queuedOut));
    }
    for (size_t channel = 0; channel < impl.channels; ++channel) {
      impl.outPtrs[channel] = impl.drainBuffer[channel].data() + queuedOut;
    }
    impl.stretch.flush(impl.outPtrs, static_cast<int>(flushOut));

    for (auto &queue : impl.inputQueue) {
      queue.clear();
    }
  }

  const size_t remaining = impl.drainBuffer.empty()
      ? 0
      : impl.drainBuffer[0].size() - impl.drainReadIndex;
  const size_t frames = std::min(outputFrames, remaining);
  for (size_t channel = 0; channel < impl.channels; ++channel) {
    std::copy_n(
        impl.drainBuffer[channel].begin() + static_cast<std::ptrdiff_t>(impl.drainReadIndex),
        frames,
        output.getChannel(channel)->begin());
  }
  impl.drainReadIndex += frames;
  return frames;
}

} // namespace audioapi
