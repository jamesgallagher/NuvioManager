import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const templatePath = resolve(__dirname, '../../unraid/my-nuvio-manager.xml');

function parseTemplate(): Document {
  const xml = readFileSync(templatePath, 'utf8');
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('unraid/my-nuvio-manager.xml', () => {
  it('parses as XML with no parsererror', () => {
    const doc = parseTemplate();
    expect(doc.querySelector('parsererror')).toBeNull();
  });

  it('root Container has version="2"', () => {
    const doc = parseTemplate();
    const container = doc.querySelector('Container');
    expect(container).not.toBeNull();
    expect(container!.getAttribute('version')).toBe('2');
  });

  it('every element in the 5.5 table has exactly the value given', () => {
    const doc = parseTemplate();
    const text = (tag: string): string => doc.querySelector(tag)?.textContent ?? '';
    expect(text('Name')).toBe('Nuvio Manager');
    expect(text('Repository')).toBe('ghcr.io/jamesgallagher/nuvio-manager:latest');
    expect(text('Registry')).toBe('https://github.com/jamesgallagher/NuvioManager/pkgs/container/nuvio-manager');
    expect(text('Network')).toBe('bridge');
    expect(text('Shell')).toBe('sh');
    expect(text('Privileged')).toBe('false');
    expect(text('Support')).toBe('https://github.com/jamesgallagher/NuvioManager/issues');
    expect(text('Project')).toBe('https://github.com/jamesgallagher/NuvioManager');
    expect(text('ReadMe')).toBe('https://github.com/jamesgallagher/NuvioManager#readme');
    expect(text('Category')).toBe('Tools: Utilities:');
    expect(text('WebUI')).toBe('http://[IP]:[PORT:8095]/');
    expect(text('TemplateURL')).toBe('https://raw.githubusercontent.com/jamesgallagher/NuvioManager/main/unraid/my-nuvio-manager.xml');
    expect(text('Icon')).toBe('https://raw.githubusercontent.com/jamesgallagher/NuvioManager/main/unraid/nuvio-manager-icon.png');

    // None of these may be empty.
    for (const tag of ['Name', 'Repository', 'Registry', 'Support', 'Project', 'ReadMe', 'Overview', 'Category', 'WebUI', 'TemplateURL', 'Icon', 'Changes']) {
      expect(text(tag).length).toBeGreaterThan(0);
    }
  });

  it('WebUI contains [IP] and [PORT:8095], and [PORT:8095] equals the port config Default', () => {
    const doc = parseTemplate();
    const webui = doc.querySelector('WebUI')?.textContent ?? '';
    expect(webui).toContain('[IP]');
    expect(webui).toContain('[PORT:8095]');

    const portConfig = Array.from(doc.querySelectorAll('Config')).find((c) => c.getAttribute('Type') === 'Port');
    expect(portConfig).toBeDefined();
    expect(portConfig!.getAttribute('Default')).toBe('8095');
    expect(webui).toContain(`[PORT:${portConfig!.getAttribute('Default')}]`);
  });

  it('Icon URL ends in nuvio-manager-icon.png and the file exists; TemplateURL ends in unraid/my-nuvio-manager.xml', () => {
    const doc = parseTemplate();
    const icon = doc.querySelector('Icon')?.textContent ?? '';
    expect(icon.endsWith('nuvio-manager-icon.png')).toBe(true);
    expect(existsSync(resolve(__dirname, '../../unraid/nuvio-manager-icon.png'))).toBe(true);

    const templateUrl = doc.querySelector('TemplateURL')?.textContent ?? '';
    expect(templateUrl.endsWith('unraid/my-nuvio-manager.xml')).toBe(true);
  });

  it('exactly three Config entries with the expected Names, Targets, Types, Defaults and Required flags; no Type="Path"', () => {
    const doc = parseTemplate();
    const configs = Array.from(doc.querySelectorAll('Config'));
    expect(configs).toHaveLength(3);

    const byName = (name: string) => configs.find((c) => c.getAttribute('Name') === name);

    const port = byName('WebUI Port');
    expect(port).toBeDefined();
    expect(port!.getAttribute('Target')).toBe('8080');
    expect(port!.getAttribute('Default')).toBe('8095');
    expect(port!.getAttribute('Type')).toBe('Port');
    expect(port!.getAttribute('Mode')).toBe('tcp');
    expect(port!.getAttribute('Required')).toBe('true');
    expect(port!.getAttribute('Description')).toBe('Port for the Nuvio Manager web interface.');
    expect(port!.textContent).toBe('8095');

    const url = byName('Supabase URL');
    expect(url).toBeDefined();
    expect(url!.getAttribute('Target')).toBe('SUPABASE_URL');
    expect(url!.getAttribute('Default')).toBe('https://api.nuvio.tv');
    expect(url!.getAttribute('Type')).toBe('Variable');
    expect(url!.getAttribute('Required')).toBe('false');
    expect(url!.textContent).toBe('https://api.nuvio.tv');

    const anonKey = byName('Supabase anon key');
    expect(anonKey).toBeDefined();
    expect(anonKey!.getAttribute('Target')).toBe('SUPABASE_ANON_KEY');
    expect(anonKey!.getAttribute('Default')).toBe('');
    expect(anonKey!.getAttribute('Type')).toBe('Variable');
    expect(anonKey!.getAttribute('Required')).toBe('false');
    expect(anonKey!.textContent).toBe('');

    for (const c of configs) {
      expect(c.getAttribute('Type')).not.toBe('Path');
    }
  });

  it('Repository matches the expected pattern and contains no uppercase', () => {
    const doc = parseTemplate();
    const repository = doc.querySelector('Repository')?.textContent ?? '';
    expect(repository).toMatch(/^ghcr\.io\/jamesgallagher\/nuvio-manager:latest$/);
    expect(repository).not.toMatch(/[A-Z]/);
  });
});
