import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, expect, test, vi } from 'vitest';

const attachmentHandlerTestState = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  downloadsPath: '/tmp/agora-downloads',
  tempPath: '/tmp/agora-temp',
}));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'downloads') {
        return attachmentHandlerTestState.downloadsPath;
      }
      if (name === 'temp') {
        return attachmentHandlerTestState.tempPath;
      }
      return '/tmp';
    },
  },
  dialog: {
    showOpenDialog: attachmentHandlerTestState.showOpenDialog,
  },
}));

import { AttachmentHandler } from './AttachmentHandler';

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-attachment-handler-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

test('returns a null path when directory selection is canceled', async () => {
  attachmentHandlerTestState.showOpenDialog.mockResolvedValueOnce({
    canceled: true,
    filePaths: [],
  });

  const handler = new AttachmentHandler();

  await expect(handler.selectDirectory(null)).resolves.toEqual({
    success: true,
    path: null,
  });
  expect(attachmentHandlerTestState.showOpenDialog).toHaveBeenCalledWith({
    properties: ['openDirectory', 'createDirectory'],
  });
});

test('copies a local image into the selected directory with a sanitized name', async () => {
  const sourceDir = createTempDir();
  const targetDir = createTempDir();
  const sourcePath = path.join(sourceDir, 'source-image.png');

  fs.writeFileSync(sourcePath, Buffer.from('image-bytes'));
  attachmentHandlerTestState.downloadsPath = targetDir;
  attachmentHandlerTestState.showOpenDialog.mockResolvedValueOnce({
    canceled: false,
    filePaths: [targetDir],
  });

  const handler = new AttachmentHandler();
  const result = await handler.saveLocalImageToDirectory(null, {
    sourcePath,
    fileName: '../unsafe export',
  });

  expect(result).toMatchObject({
    success: true,
    canceled: false,
    path: path.join(targetDir, 'unsafe export.png'),
  });
  expect(fs.readFileSync(result.path!, 'utf-8')).toBe('image-bytes');
});

test('writes inline file payloads into the cwd attachment workspace', async () => {
  const workspaceDir = createTempDir();
  vi.spyOn(Date, 'now').mockReturnValue(1_717_171_717_000);
  vi.spyOn(Math, 'random').mockReturnValue(0.123456);

  const handler = new AttachmentHandler();
  const result = await handler.saveInlineFile({
    dataBase64: Buffer.from('hello attachment').toString('base64'),
    fileName: 'notes',
    mimeType: 'text/plain',
    cwd: workspaceDir,
  });

  expect(result.success).toBe(true);
  expect(result.path).toMatch(
    new RegExp(
      `${workspaceDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\.cowork-temp/attachments/manual/notes-1717171717000-[a-z0-9]{6}\\.txt$`,
    ),
  );
  expect(fs.readFileSync(result.path!, 'utf-8')).toBe('hello attachment');
});

test('reads local files back as data URLs using extension-derived mime types', async () => {
  const tempDir = createTempDir();
  const imagePath = path.join(tempDir, 'preview.png');
  const content = Buffer.from('tiny-image');

  fs.writeFileSync(imagePath, content);

  const handler = new AttachmentHandler();
  const result = await handler.readFileAsDataUrl(imagePath);

  expect(result).toEqual({
    success: true,
    dataUrl: `data:image/png;base64,${content.toString('base64')}`,
  });
});
