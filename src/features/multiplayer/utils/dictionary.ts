/**
 * dictionary
 * Utility to generate friendly room IDs for multiplayer.
 */
const adjectives = [
  'Rapid', 'Quiet', 'Chilly', 'Silent', 'Brave', 'Sunny', 'Bright', 'Rusty',
  'Shiny', 'Heavy', 'Light', 'Happy', 'Sad', 'Angry', 'Calm', 'Wild',
  'Tame', 'Loud', 'Fierce', 'Gentle', 'Proud', 'Humble', 'Fast', 'Slow',
  'Quick', 'Sharp', 'Dull', 'Smooth', 'Rough', 'Soft', 'Hard', 'Hot',
  'Cold', 'Warm', 'Cool', 'Fresh', 'Stale', 'Sweet', 'Sour', 'Bitter',
  'Salty', 'Spicy', 'Mild', 'Strong', 'Weak', 'Bold', 'Shy', 'Crazy',
  'Chunky', 'Silly', 'Wobbly', 'Jumpy'
];

const nouns = [
  'Tiger', 'Window', 'Rocket', 'Apple', 'Banana', 'Orange', 'Lemon', 'Berry',
  'Melon', 'Peach', 'Plum', 'Grape', 'Mango', 'Cherry', 'Pear', 'Kiwi',
  'Tree', 'Flower', 'Leaf', 'Grass', 'Bush', 'Root', 'Branch', 'Stem',
  'Bird', 'Fish', 'Bear', 'Lion', 'Wolf', 'Fox', 'Deer', 'Hare',
  'Frog', 'Toad', 'Snake', 'Lizard', 'Turtle', 'Crab', 'Snail', 'Worm',
  'Bug', 'Bee', 'Ant', 'Fly', 'Moth', 'Wasp', 'Spider', 'Beetle',
  'Coffee', 'Keyboard', 'Mouse', 'Monitor'
];

export function generateRoomId(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}
