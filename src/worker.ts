import * as fs from 'fs';
import Puppeteer from './puppeteer';

export type ConfigProperties = {
  origin: {
    id: string;
    password: string;
  };
  target: {
    id: string;
    password: string;
  };
}

export default class Worker {
  origin: ConfigProperties['origin'];

  target: ConfigProperties['target'];

  accountListFileName = 'accounts.txt';

  constructor() {
    const config = this.readConfig();
    this.origin = config.origin;
    this.target = config.target;
  }

  public async run(): Promise<void> {
    const isExist = fs.existsSync(this.accountListFileName);

    if (!isExist) {
      const followAccounts = await this.getFollowAccounts();
      fs.writeFileSync(this.accountListFileName, followAccounts.join('\n'));
    }

    this.follow(fs.readFileSync(this.accountListFileName, 'utf-8').split('\n'));
  }

  private async getFollowAccounts(): Promise<string[]> {
    let pup: Puppeteer | null = null;

    try {
      pup = await new Puppeteer().initialize();

      if (!pup.browser || !pup.page) {
        throw new Error('Property not set.');
      }

      await pup.page.goto('https://twitter.com/login', { waitUntil: 'domcontentloaded' });
      await pup.page.waitFor(2000);
      await pup.page.type('input[name=session\\[username_or_email\\]].js-username-field', this.origin.id);
      await pup.page.waitFor(100);
      await pup.page.type('input[name=session\\[password\\]].js-password-field', this.origin.password);
      await pup.page.click('.js-signin .EdgeButton--primary');
      await pup.page.waitFor(3000);
      await pup.page.goto(`https://twitter.com/${this.origin.id.replace(/^@/, '')}/following`, { waitUntil: 'domcontentloaded' });
      await pup.page.waitFor(3000);
      let followAccountList: string[] = [];

      while (true) {
        const before = await pup.page.evaluate(() => window.pageYOffset);
        const followAccounts = await pup.page.evaluate(() => Array.from(document
          .querySelectorAll('[aria-label="タイムライン: フォロー中"] a[role="link"] div[dir=ltr] span'))
          .map((e) => e.innerHTML));
        followAccountList.push(...followAccounts);
        await pup.page.evaluate(() => { window.scrollBy(0, 1500); });
        await pup.page.waitFor(2000);
        const after = await pup.page.evaluate(() => window.pageYOffset);
        if (before === after) {
          break;
        }
      }
      
      followAccountList = followAccountList
        .filter((account, i, origin) => origin.indexOf(account) === i);

      await pup.browser.close();
      return followAccountList;
    } catch (e) {
      throw new Error(e.message);
    } finally {
      await pup?.browser?.close();
    }
  }

  private async follow(accounts: string[]): Promise<void> {
    let pup: Puppeteer | null = null;

    try {
      pup = await new Puppeteer().initialize();

      if (!pup.browser || !pup.page) {
        throw new Error('Property not set.');
      }
      await pup.page.goto('https://twitter.com/login', { waitUntil: 'domcontentloaded' });
      await pup.page.waitFor(2000);
      await pup.page.type('input[name=session\\[username_or_email\\]].js-username-field', this.target.id);
      await pup.page.waitFor(100);
      await pup.page.type('input[name=session\\[password\\]].js-password-field', this.target.password);
      await pup.page.click('.js-signin .EdgeButton--primary');
      await pup.page.waitFor(3000);
      for (const account of accounts) {
        await pup.page.goto(`https://twitter.com/${account.replace(/@/, '')}`, { waitUntil: 'domcontentloaded' });
        await pup.page.waitFor(2000);
        const isFollow = await pup.page.$eval('[role=button][data-testid] [dir=auto] span span', element => {
          if (element.innerHTML === 'フォロー') {
            (element as any).click();
          }

          return element.innerHTML === 'フォロー中';
        });

        if (isFollow) {
          this.deleteAccount(account);
        }
      }
      await pup.browser.close();
    } catch (e) {
      throw new Error(e.message);
    } finally {
      await pup?.browser?.close();
    }
  }

  private deleteAccount(accountName: string): void {
    let accounts = fs.readFileSync(this.accountListFileName, 'utf-8').split('\n');
    accounts = accounts.filter(e => e !== accountName);
    fs.writeFileSync(this.accountListFileName, accounts.join('\n'));
  }

  private readConfig(): ConfigProperties {
    return JSON.parse(fs.readFileSync('.secret', 'utf-8'));
  }
}
