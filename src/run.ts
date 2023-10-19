import { UrlImport } from './index.js';

const ui = new UrlImport({
  name: 'screenshots',
  saveScreenshot: [
    { viewport: { width: 640, height: 480 } },
    { viewport: { width: 640, height: 480 }, fullPage: true }
  ],
  saveDom: false,
  url: {
    '1995-mrd': 'https://eaton-fyi-cold-storage.netlify.app/mrd/',
    '1996-home': 'https://eaton-fyi-cold-storage.netlify.app/home-1996/',
    '1997-home': 'https://eaton-fyi-cold-storage.netlify.app/home-1997/',
    '1997-hope': 'https://eaton-fyi-cold-storage.netlify.app/hope/',
    '1997-cstone': 'https://eaton-fyi-cold-storage.netlify.app/cstone/',
    '1997-phoenix': 'https://eaton-fyi-cold-storage.netlify.app/phoenix/',
    '1998-home': 'https://eaton-fyi-cold-storage.netlify.app/home-1998/',
    '1999-home': 'https://eaton-fyi-cold-storage.netlify.app/home-1999/',
    '2000-home': 'https://eaton-fyi-cold-storage.netlify.app/home-2000/',
    '2002-home': 'https://eaton-fyi-cold-storage.netlify.app/home-2002/',
    '2003-home': 'https://eaton-fyi-cold-storage.netlify.app/home-2003/',
  }
});

await ui.fillCache();
await ui.teardown();