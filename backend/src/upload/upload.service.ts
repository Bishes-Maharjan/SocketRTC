// upload/upload.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

@Injectable()
export class UploadService {
  private readonly uploadDir = './public/uploads';

  async downloadAndSaveImage(url: string): Promise<string> {
    try {
      // Fetch image from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Generate unique filename
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = '.jpg';
      const filename = `${unique}${ext}`;

      // Ensure directory exists
      await mkdir(this.uploadDir, { recursive: true });

      // Save file
      const filePath = path.join(this.uploadDir, filename);
      await writeFile(filePath, buffer);

      // Return relative URL path
      return `/uploads/${filename}`;
    } catch (error) {
      console.error('Error downloading image:', error);
      // Return null or default avatar if download fails
      return "";
    }
  }
}