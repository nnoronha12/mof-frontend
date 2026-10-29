import React, { useEffect, useRef } from "react";
import { hexToRgba, ThemeColors } from "./WeaveAiChat";

type WaveformVisualizerProps = {
  listening: boolean;
  themeColors: ThemeColors;
};

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ listening, themeColors }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!listening) return;

    let analyser: AnalyserNode | null = null;
    let waveformData: Uint8Array | null = null;
    let levels: number[] = [];
    let isDisposed = false;

    const drawRoundedBar = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) => {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      context.fill();
    };

    const draw = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || isDisposed) return;

      const { width, height } = canvas;
      const centerY = height / 2;
      const barWidth = 3;
      const gap = 3;
      const barCount = Math.floor((width - 24) / (barWidth + gap));
      const startX = (width - barCount * (barWidth + gap) + gap) / 2;

      if (levels.length !== barCount) levels = Array(barCount).fill(3);
      if (analyser && waveformData) analyser.getByteTimeDomainData(waveformData);

      context.clearRect(0, 0, width, height);
      context.fillStyle = hexToRgba(themeColors.primary, 0.58);

      for (let index = 0; index < barCount; index += 1) {
        const start = waveformData
          ? Math.floor((index / barCount) * waveformData.length)
          : 0;
        const end = waveformData
          ? Math.max(start + 1, Math.floor(((index + 1) / barCount) * waveformData.length))
          : 1;
        let sumOfSquares = 0;
        for (let sample = start; waveformData && sample < end; sample += 1) {
          const normalizedSample = (waveformData[sample] - 128) / 128;
          sumOfSquares += normalizedSample * normalizedSample;
        }
        const rms = waveformData ? Math.sqrt(sumOfSquares / (end - start)) : 0;
        // Each bar represents the actual microphone amplitude over its time
        // slice. Smoothing prevents jitter without inventing idle movement.
        const targetHeight = Math.max(3, Math.min(20, 3 + rms * 240));
        levels[index] += (targetHeight - levels[index]) * 0.2;

        const barHeight = levels[index];
        drawRoundedBar(
          context,
          startX + index * (barWidth + gap),
          centerY - barHeight / 2,
          barWidth,
          barHeight,
          barWidth / 2
        );
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    const startAudioAnalysis = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (isDisposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const audioContext = new AudioContext();
        const nextAnalyser = audioContext.createAnalyser();
        nextAnalyser.fftSize = 1024;
        nextAnalyser.smoothingTimeConstant = 0.72;
        audioContext.createMediaStreamSource(stream).connect(nextAnalyser);

        streamRef.current = stream;
        audioContextRef.current = audioContext;
        analyser = nextAnalyser;
        waveformData = new Uint8Array(nextAnalyser.fftSize);
      } catch (error) {
        // Keep the calm idle animation visible if microphone access is denied.
        console.error("Unable to start microphone visualizer:", error);
      }
    };

    animationFrameRef.current = requestAnimationFrame(draw);
    startAudioAnalysis();

    return () => {
      isDisposed = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current?.close();
      streamRef.current = null;
      audioContextRef.current = null;
    };
  }, [listening, themeColors.primary]);

  if (!listening) return null;

  return (
    <div
      className="flex-1 min-w-0 h-9 px-2 flex items-center rounded-full pointer-events-none"
      style={{
        backgroundColor: hexToRgba(themeColors.primary, 0.07),
        border: `1px solid ${hexToRgba(themeColors.primary, 0.15)}`,
      }}
    >
      <canvas
        ref={canvasRef}
        width={600}
        height={36}
        className="w-full h-9 pointer-events-none"
        aria-label="Recording audio waveform"
      />
    </div>
  );
};

export default WaveformVisualizer;
