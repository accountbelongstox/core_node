let activeAudio: HTMLAudioElement | null = null;

export const stopSharedAudio = (): void => {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio = null;
};

export const playSharedAudio = async (url: string): Promise<void> => {
  stopSharedAudio();
  const audio = new Audio(url);
  activeAudio = audio;
  audio.addEventListener('ended', () => {
    if (activeAudio === audio) activeAudio = null;
  });
  try {
    await audio.play();
  } catch (error) {
    if (activeAudio === audio) activeAudio = null;
    throw error;
  }
};
