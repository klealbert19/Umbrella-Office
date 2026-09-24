/**
 * Testes de FilesystemEngine + FilesystemSecurity (V0.2).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../src/logging/logger';
import { FilesystemSecurity } from '../src/filesystem/filesystem-security';
import { FilesystemEngine } from '../src/filesystem/filesystem-engine';

function makeLogger(): Logger {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-fs-log-'));
  return new Logger(path.join(dir, 'office.log'));
}

function makeTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-fs-ws-'));
}

describe('filesystem-security', () => {
  it('should block access without active workspace', () => {
    const sec = new FilesystemSecurity(makeLogger());
    expect(() => sec.checkRead('/tmp/a.txt')).toThrow('Nenhum workspace ativo');
  });

  it('should allow paths inside workspace', () => {
    const ws = makeTempWorkspace();
    const sec = new FilesystemSecurity(makeLogger());
    sec.setActiveWorkspace(ws);
    const file = path.join(ws, 'a.txt');
    expect(sec.checkRead(file)).toBeTruthy();
  });

  it('should block path traversal outside workspace', () => {
    const ws = makeTempWorkspace();
    const sec = new FilesystemSecurity(makeLogger());
    sec.setActiveWorkspace(ws);
    const outside = path.resolve(path.join(ws, '..', 'outside.txt'));
    expect(() => sec.checkRead(outside)).toThrow('Acesso negado');
  });

  it('should clear workspace and block again', () => {
    const ws = makeTempWorkspace();
    const sec = new FilesystemSecurity(makeLogger());
    sec.setActiveWorkspace(ws);
    sec.clearActiveWorkspace();
    expect(() => sec.checkRead(path.join(ws, 'a.txt'))).toThrow('Nenhum workspace ativo');
  });
});

describe('filesystem-engine', () => {
  it('should write, read, edit, list and delete inside workspace', async () => {
    const ws = makeTempWorkspace();
    const logger = makeLogger();
    const sec = new FilesystemSecurity(logger);
    sec.setActiveWorkspace(ws);
    const engine = new FilesystemEngine(logger, sec);

    // write
    const filePath = path.join(ws, 'hello.txt');
    const write = await engine.writeFile(filePath, 'hello world');
    expect(write.success).toBe(true);
    expect(write.bytesWritten).toBeGreaterThan(0);

    // read
    const read = await engine.readFile(filePath);
    expect(read.success).toBe(true);
    expect(read.file?.content).toBe('hello world');

    // edit (single)
    const edit = await engine.editFile(filePath, 'world', 'umbrella');
    expect(edit.success).toBe(true);
    expect(edit.replacements).toBe(1);
    const read2 = await engine.readFile(filePath);
    expect(read2.file?.content).toBe('hello umbrella');

    // edit replaceAll
    await engine.writeFile(filePath, 'a a a');
    const editAll = await engine.editFile(filePath, 'a', 'b', true);
    expect(editAll.success).toBe(true);
    expect(editAll.replacements).toBe(3);

    // list
    const list = await engine.listDirectory(ws);
    expect(list.success).toBe(true);
    expect(list.entries?.some((e) => e.name === 'hello.txt')).toBe(true);

    // create directory
    const sub = path.join(ws, 'sub', 'nested');
    const created = await engine.createDirectory(sub);
    expect(created.success).toBe(true);
    expect(fs.existsSync(sub)).toBe(true);

    // delete
    const del = await engine.deleteFile(filePath);
    expect(del.success).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('should fail to read outside workspace', async () => {
    const ws = makeTempWorkspace();
    const logger = makeLogger();
    const sec = new FilesystemSecurity(logger);
    sec.setActiveWorkspace(ws);
    const engine = new FilesystemEngine(logger, sec);
    const outside = path.resolve(path.join(ws, '..', 'outside.txt'));
    const result = await engine.readFile(outside);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Acesso negado|Nenhum workspace/);
  });

  it('should return error when oldText not found', async () => {
    const ws = makeTempWorkspace();
    const logger = makeLogger();
    const sec = new FilesystemSecurity(logger);
    sec.setActiveWorkspace(ws);
    const engine = new FilesystemEngine(logger, sec);
    const filePath = path.join(ws, 'edit.txt');
    await engine.writeFile(filePath, 'hello');
    const result = await engine.editFile(filePath, 'notfound', 'x');
    expect(result.success).toBe(false);
    expect(result.code).toBe('EDIT_NOT_FOUND');
  });

  it('should fail to delete a directory as file', async () => {
    const ws = makeTempWorkspace();
    const logger = makeLogger();
    const sec = new FilesystemSecurity(logger);
    sec.setActiveWorkspace(ws);
    const engine = new FilesystemEngine(logger, sec);
    const sub = path.join(ws, 'mydir');
    await engine.createDirectory(sub);
    const result = await engine.deleteFile(sub);
    expect(result.success).toBe(false);
    expect(result.code).toBe('DELETE_NOT_FILE');
  });
});
