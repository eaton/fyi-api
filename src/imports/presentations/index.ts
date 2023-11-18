import { Keynote, Disk, Text, KeynoteSlide, Image } from "mangler";

const source = Disk.dir('/Users/jeff/Library/Mobile Documents/com~apple~Keynote/Documents');
let decks = source.find({ matching: '**/*.key' }).map(f => source.path(f));

await migrateDecks(decks);

export async function migrateDecks(files: string[]) {
  const cache = Disk.dir('output/presentations');

  for (const file of files) {
    let k = await Keynote.open(file);

    const slug = Text.toSlug(k.title);
    const output = (file.split('/').length > 1) ? cache.dir(file.split('/').slice(-2,-1).join('/')).dir(slug) : cache.dir(slug);

    console.log(`Exporting ${k.title} to ${output.path()}`);

    if (output.exists('index.md')) {
      console.log(`Skipping ${output.path()}`);
      continue;
    }

    await k.export({ 
      format: 'JSON with images',
      exportStyle: 'IndividualSlides',
      path: output.path()
    });

    await k.export({ 
      format: 'PDF',
      exportStyle: 'IndividualSlides',
      pdfImageQuality: 'Better',
      path: output.path()
    });

    await k.export({ 
      format: 'slide images',
      allStages: true,
      exportStyle: 'IndividualSlides',
      path: output.path()
    });

    await k.export({ 
      format: 'QuickTime movie',
      movieFormat: 'format720p',
      movieFramerate: 'FPS12',
      movieCodec: 'h264',
      path: output.path(),
    });

    output.find({ matching: '**/*.jpeg' }).forEach(
      async img => Image.load(output.path(img))
        .resize({ fit: 'inside', width: 720, withoutEnlargement: true })
        .jpeg({ progressive: true, quality: 80 })
        .toBuffer()
        .then(b => output.writeAsync(img, b))
        .catch((err: unknown) => console.log(err))
    );

    const markdown = {
      data: {
        slug,
        date: k.created,
        title: k.title,
        theme: k.theme,
        layout: 'presentation'
      },
      content: k.slides.filter(s => !s.skipped).map(s => makeMarkdownSlide(s)).join('\n\n---\n\n'),
    }
    output.write('index.md', markdown);
    await k.close();
  }
}

function makeMarkdownSlide(slide: KeynoteSlide): string {
  const output: string[] = [];
  if (slide.title) output.push(`### ${slide.title.replaceAll('\n', ' ')}`);
  if (slide.body) output.push(slide.body);
  output.push(`![Slide number ${slide.number}](images/images.${slide.number.toString().padStart(3, '0')}.jpeg)`);
  if (slide.notes) output.push(`${slide.notes}`);

  return output.join('\n\n');
}