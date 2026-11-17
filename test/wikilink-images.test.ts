import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { load } from 'cheerio';
import { Notebook } from '../src/notebook';

describe('Obsidian image wikilinks', () => {
  let root: string;
  let notebook: Notebook;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'crossnote-images-'));
    await fs.mkdir(path.join(root, 'attachments/nested'), { recursive: true });
    await fs.mkdir(path.join(root, 'notes'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'attachments/nested/sample image.png'),
      '',
    );
    notebook = await Notebook.init({
      notebookPath: root,
      config: { wikiLinkResolution: 'shortest' },
    });
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test.each([
    ['sample image.png', undefined, undefined],
    ['sample image.png|400', '400', undefined],
    ['sample image.png|400x300', '400', '300'],
    ['nested/sample image.png|400', '400', undefined],
    ['sample%20image.png|400', '400', undefined],
  ])('resolves %s in block and inline images', async (link, width, height) => {
    const engine = notebook.getNoteMarkdownEngine('notes/example.md');
    for (const markdown of [`![[${link}]]`, `Before ![[${link}]] after.`]) {
      const { html } = await engine.parseMD(markdown, {
        isForPreview: true,
        useRelativeFilePath: false,
        hideFrontMatter: false,
      });
      const image = load(html)('img');
      expect(image).toHaveLength(1);
      expect(fileURLToPath(image.attr('src')!)).toBe(
        path.join(root, 'attachments/nested/sample image.png'),
      );
      expect(image.attr('width')).toBe(width);
      expect(image.attr('height')).toBe(height);
    }
  });

  test('preserves image syntax inside fenced code blocks', async () => {
    const markdown = '```markdown\n![[sample image.png|400]]\n```';
    const { html } = await notebook
      .getNoteMarkdownEngine('notes/code.md')
      .parseMD(markdown, {
        isForPreview: true,
        useRelativeFilePath: false,
        hideFrontMatter: false,
      });
    const $ = load(html);
    expect($('img')).toHaveLength(0);
    expect($('code').text()).toContain('![[sample image.png|400]]');
  });
});
