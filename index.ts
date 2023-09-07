import write from 'write'
import type { Page } from 'puppeteer'
import ora from 'ora'
import Sitemapper from 'sitemapper'
import { Cluster } from '@drtz/puppeteer-cluster'

// Define variables for crawl
const sitemap = 'https://mattwaler.com/sitemap.xml'
const concurrency = 8
const data: any = {
  pages: []
}

// What to do on each page
async function action(page: Page) {
  const hero = await page.$('.h1')
  if (hero) {
    data.pages.push(await page.url())
  }
}

// What to do after crawl
async function postActions() {
  await write(`./reports/${new Date().toISOString()}.json`, JSON.stringify(data, null, 2))
}

// DO NOT EDIT - Crawl Configuration
async function crawl() {
  const spinner = await ora()
  const cluster = await Cluster.launch({
    monitor: true,
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: concurrency,
  })

  try {
    // Sitemap Scan
    spinner.start('Fetching pages from sitemap...')
    const sitemapper = new Sitemapper({
      url: sitemap,
      timeout: 20000,
    })
    let { sites: pages } = await sitemapper.fetch()
    spinner.succeed('Successfully scanned sitemap.')

    // Crawl!
    await cluster.task(async ({ page, data: url }) => {
      await page.goto(url)
      await action(page)
    })
    pages.forEach(page => cluster.queue(page))
    await cluster.idle();
    await cluster.close();
    spinner.succeed('Site crawl complete.')

    // Post-crawl Actions
    spinner.start('Executing post-crawl actions...')
    await postActions()
    spinner.succeed('Post-crawl actions complete.')
  } catch (err) {
    spinner.fail(err.toString())
    await cluster.close()
  }
}

crawl()
