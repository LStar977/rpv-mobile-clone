import { continueRender, delayRender, staticFile } from 'remotion';

const handle = delayRender('Loading Represent brand fonts');

const faces: [string, string, string, string][] = [
  ['Newsreader', 'fonts/Newsreader-Regular.ttf', '400', 'normal'],
  ['Newsreader', 'fonts/Newsreader-Medium.ttf', '500', 'normal'],
  ['Newsreader', 'fonts/Newsreader-Italic.ttf', '400', 'italic'],
  ['Onest', 'fonts/Onest-Regular.ttf', '400', 'normal'],
  ['Onest', 'fonts/Onest-SemiBold.ttf', '600', 'normal'],
  ['Onest', 'fonts/Onest-Bold.ttf', '700', 'normal'],
  ['JetBrainsMono', 'fonts/JetBrainsMono-Medium.ttf', '500', 'normal'],
];

Promise.all(
  faces.map(([family, file, weight, style]) => {
    const face = new FontFace(family, `url(${staticFile(file)})`, { weight, style });
    return face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
  })
)
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
