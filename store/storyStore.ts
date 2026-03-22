import type { Story } from '../types/story';

let stories: Story[] = [];
let listeners: Array<() => void> = [];

export function addStory(story: Story) {
  stories.unshift(story);
  emit();
}

export function getStories() {
  return stories;
}

export function subscribeStories(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emit() {
  listeners.forEach((l) => l());
}

export function cleanExpiredStories() {
  const now = new Date().toISOString();
  stories = stories.filter((story) => story.expiresAt > now);
  emit();
}
