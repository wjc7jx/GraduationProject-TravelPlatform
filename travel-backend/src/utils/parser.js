import exifr from 'exifr';
import { DOMParser } from '@xmldom/xmldom';
import { gpx, kml } from '@tmcw/togeojson';
import fs from 'fs';
import path from 'path';

/**
 * 从内存缓冲区解析图片 EXIF（用于对象存储 URL 回源等场景）
 * @param {Buffer} fileBuffer
 */
export async function parseImageExifFromBuffer(fileBuffer) {
  try {
    const parsed = await exifr.parse(fileBuffer, { gps: true, tiff: true, exif: true });
    
    if (!parsed) return null;

    return {
      latitude: parsed.latitude || null,
      longitude: parsed.longitude || null,
      datetimeOriginal: parsed.DateTimeOriginal || parsed.CreateDate || null,
      // 获取图片的宽和高（对于包含宽高信息的图片）
      width: parsed.ExifImageWidth || parsed.ImageWidth || null,
      height: parsed.ExifImageHeight || parsed.ImageHeight || null,
    };
  } catch (error) {
    console.error('EXIF parse error:', error);
    return null;
  }
}

/**
 * 解析图片 EXIF 提取经纬度和拍摄时间
 * @param {string} filePath 图片绝对路径
 */
export async function parseImageExif(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return parseImageExifFromBuffer(fileBuffer);
  } catch (error) {
    console.error('EXIF parse error:', error);
    return null;
  }
}

/**
 * 从 XML 字符串解析 GPX/KML
 * @param {string} fileStr
 * @param {string} ext 含点后缀，如 ".gpx"
 */
export async function parseTrajectoryFromString(fileStr, ext) {
  try {
    const dom = new DOMParser().parseFromString(fileStr, 'text/xml');
    const normalizedExt = String(ext || '').toLowerCase();

    let geojson = null;
    if (normalizedExt === '.gpx') {
      geojson = gpx(dom);
    } else if (normalizedExt === '.kml') {
      geojson = kml(dom);
    }

    if (!geojson) return null;

    // 返回经过简化的坐标点列表用于存储到 JSON 中 (这里仅作演示结构)
    return {
      type: 'FeatureCollection',
      features: geojson.features
    };
  } catch (error) {
    console.error('Trajectory parse error:', error);
    return null;
  }
}

/**
 * 解析 GPX 或 KML 文件为 GeoJSON 的坐标点流
 * @param {string} filePath 轨迹文件绝对路径
 */
export async function parseTrajectory(filePath) {
  try {
    const fileStr = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    return parseTrajectoryFromString(fileStr, ext);
  } catch (error) {
    console.error('Trajectory parse error:', error);
    return null;
  }
}