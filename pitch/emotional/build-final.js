// The FINAL emotional deck: Lance's generated slide images, full-bleed, with
// the spoken script preserved in each slide's speaker notes. The typographic
// deck (build.js) remains the editable source if any slide ever needs to be
// regenerated or the copy changes.
const pptxgen = require('pptxgenjs');
const fs = require('fs');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.author = 'Lance Morrison';
pres.company = 'Represent';
pres.title = 'Represent — The Other 1,460 Days';

const SLIDES = [
  ['slide-01-cover.jpg',
    'Do not read this slide aloud. Let it sit while you greet the room, then begin with the school gym.'],
  ['slide-02-gym.jpg',
    'The most hopeful thing I have ever seen happens in a school gym, every four years. People line up to vote — and everybody in that line knows it probably changes nothing. They show up anyway. Billions of them, around the world. Each carrying the same small, stubborn hope: maybe this time, my life gets a little better.'],
  ['slide-03-one-day.jpg',
    'Then the doors close. And the next morning, every single one of them goes back to being a spectator — for four years.'],
  ['slide-04-ache.jpg',
    'And we all know what those four years feel like, because we live them. Everything gets more expensive. Everything gets harder. Groceries, rent, a house your kids will never afford. Maybe it is incompetence, maybe it is malice — honestly, it does not matter which. The result is identical: decisions land on your life, and nobody asked you.'],
  ['slide-05-wall.jpg',
    'And when you try to be heard, every door ends the same way. Write your representative — form letter. Sign a petition — could be bots. Go to a protest — a loud minority, waved off. Every channel a person has leads to the same wall.'],
  ['slide-06-referendums.jpg',
    'And it is not just you. Ask how often the country itself asks its people a question. Canada: three national referendums since 1867 — the last one in 1992. Britain: three in its entire history. The United States: zero. Not once in 250 years — there is no legal mechanism to even hold one. Asking the people is practically illegal. If you are under fifty-two, Canada has never asked you a single question in your life.'],
  ['slide-07-turn.jpg',
    'Pause before this slide. Then: You get one day every four years. We built the other one thousand, four hundred and sixty.'],
  ['slide-08-kitchen.jpg',
    'Represent is live on the App Store right now. But forget the technology — we have had this technology for twenty-five years. Here is what it actually is: a mom in Calgary deciding whether her kid’s school gets built, from her kitchen table, on a Tuesday night. Verified as one real person, counted once, on a public record. And a feeling most people have never had: being asked. Being asked feels like being respected.'],
  ['slide-09-calgary.jpg',
    'The last time this city dared to ask its people one question — the 2018 Olympic plebiscite — the vote cost 2.2 million dollars, the process took the better part of three years, and the infrastructure was dismantled the next day. On Represent, that question is free, and it closes by Friday.'],
  ['slide-10-creed.jpg',
    'So why am I doing this? Because I believe something our entire system quietly does not: when people get the chance to decide for themselves, they choose good. Not every person, not every time. But the majority, over time, chooses good. Every civilization that collapsed, collapsed on decisions ordinary people would never have made — and in every one of them, the good people were the majority. They just never had an instrument. Everything about how we are governed assumes people cannot be trusted with decisions. Represent is the opposite bet.'],
  ['slide-11-invitation.jpg',
    'We are not asking anyone to fund an app. We are asking them to help prove that the majority chooses good — because if that is true, everything about how we govern ourselves changes. Every generation before us wanted this. We are the first one that can actually build it. It exists. It is live. It is small. Help us make it inevitable.'],
];

for (const [file, notes] of SLIDES) {
  const s = pres.addSlide();
  s.background = { color: '040707' };
  s.addImage({
    data: 'image/jpeg;base64,' + fs.readFileSync(__dirname + '/final-images/' + file).toString('base64'),
    x: 0, y: 0, w: 13.333, h: 7.5,
  });
  s.addNotes(notes);
}

pres.writeFile({ fileName: __dirname + '/Represent-The-Other-1460-Days-FINAL.pptx' })
  .then(() => console.log('written'));
