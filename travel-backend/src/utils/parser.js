import exifr from 'exifr';
import { DOMParser } from '@xmldom/xmldom';
import { gpx, kml } from '@tmcw/togeojson';
import fs from 'fs';
import path from 'path';

/**
 * 解析图片 EXIF 提取经纬度和拍摄时间
 * @param {string} filePath 图片绝对路径
 */
export async function parseImageExif(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    // exifr 支持提取 GPS 和原始拍摄时间
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
 * 解析 GPX 或 KML 文件为 GeoJSON 的坐标点流
 * @param {string} filePath 轨迹文件绝对路径
 */
export async function parseTrajectory(filePath) {
  try {
    const fileStr = fs.readFileSync(filePath, 'utf-8');
    const dom = new DOMParser().parseFromString(fileStr, 'text/xml');
    const ext = path.extname(filePath).toLowerCase();

    let geojson = null;
    if (ext === '.gpx') {
      geojson = gpx(dom);
    } else if (ext === '.kml') {
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