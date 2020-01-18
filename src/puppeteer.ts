import * as puppeteer from 'puppeteer';

export default class Puppeteer {
    public page: puppeteer.Page | null = null;

    public browser: puppeteer.Browser | null = null;

    private launchArg = {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    };

    public async initialize(): Promise<this> {
      this.browser = await puppeteer.launch(this.launchArg);
      this.page = await this.browser.newPage();
      return this;
    }
}
