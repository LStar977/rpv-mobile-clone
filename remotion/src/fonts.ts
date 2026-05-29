import { loadFont as loadGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadSerif } from '@remotion/google-fonts/InstrumentSerif';

// Space Grotesk for everything; Instrument Serif (italic) for accent words.
export const grotesk = loadGrotesk('normal', {
  weights: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
}).fontFamily;

export const serif = loadSerif('italic', {
  weights: ['400'],
  subsets: ['latin'],
}).fontFamily;
