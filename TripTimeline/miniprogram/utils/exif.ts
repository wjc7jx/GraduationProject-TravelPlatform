export interface ParsedExif {
  datetimeOriginal: string | null;
  latitude: number | null;
  longitude: number | null;
}

const TAGS_IFD0: Record<number, keyof ParsedExif | 'ExifOffset' | 'GPSInfo'> = {
  0x8769: 'ExifOffset',
  0x8825: 'GPSInfo'
};

const TAGS_EXIF: Record<number, keyof ParsedExif> = {
  0x9003: 'datetimeOriginal'
};

const TAGS_GPS: Record<number, 'GPSLatitudeRef' | 'GPSLatitude' | 'GPSLongitudeRef' | 'GPSLongitude'> = {
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude'
};

interface GpsTags {
  GPSLatitudeRef?: string;
  GPSLatitude?: number[];
  GPSLongitudeRef?: string;
  GPSLongitude?: number[];
}

interface ExifParseResult {
  ExifOffset?: number;
  GPSInfo?: number;
  datetimeOriginal?: string;
}

function getString(view: DataView, start: number, length: number) {
  let value = '';
  for (let i = start; i < start + length; i += 1) {
    value += String.fromCharCode(view.getUint8(i));
  }
  return value;
}

function readTagValue(view: DataView, entryOffset: number, tiffStart: number, littleEndian: boolean) {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const valueFieldOffset = entryOffset + 8;

  const unitSizeByType: Record<number, number> = {
    1: 1,
    2: 1,
    3: 2,
    4: 4,
    5: 8,
    7: 1,
    9: 4,
    10: 8
  };
  const unitSize = unitSizeByType[type] || 0;
  if (!unitSize) return null;

  const valueOffset = unitSize * count <= 4
    ? valueFieldOffset
    : tiffStart + view.getUint32(valueFieldOffset, littleEndian);

  if (type === 2) {
    return getString(view, valueOffset, Math.max(0, count - 1));
  }

  if (type === 5) {
    const values: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const numerator = view.getUint32(valueOffset + i * 8, littleEndian);
      const denominator = view.getUint32(valueOffset + i * 8 + 4, littleEndian);
      if (!denominator) {
        values.push(0);
      } else {
        values.push(numerator / denominator);
      }
    }
    return count === 1 ? values[0] : values;
  }

  if (type === 3) {
    const values: number[] = [];
    for (let i = 0; i < count; i += 1) {
      values.push(view.getUint16(valueOffset + i * 2, littleEndian));
    }
    return count === 1 ? values[0] : values;
  }

  if (type === 4) {
    const values: number[] = [];
    for (let i = 0; i < count; i += 1) {
      values.push(view.getUint32(valueOffset + i * 4, littleEndian));
    }
    return count === 1 ? values[0] : values;
  }

  return null;
}

function readTags<T extends Record<number, string>>(
  view: DataView,
  tiffStart: number,
  dirStart: number,
  map: T,
  littleEndian: boolean
) {
  const entries = view.getUint16(dirStart, littleEndian);
  const tags: Record<string, any> = {};
  for (let i = 0; i < entries; i += 1) {
    const entryOffset = dirStart + 2 + i * 12;
    const tagId = view.getUint16(entryOffset, littleEndian);
    const key = map[tagId];
    if (!key) continue;
    tags[key] = readTagValue(view, entryOffset, tiffStart, littleEndian);
  }
  return tags;
}

function toDecimalDegrees(values?: number[], ref?: string) {
  if (!values || values.length < 3) return null;
  const degrees = Number(values[0]) || 0;
  const minutes = Number(values[1]) || 0;
  const seconds = Number(values[2]) || 0;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (ref === 'S' || ref === 'W') {
    decimal *= -1;
  }
  return decimal;
}

export function parseExifFromArrayBuffer(buffer: ArrayBuffer): ParsedExif | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return null;
  }

  let offset = 2;
  while (offset < view.byteLength - 1) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;

    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2) break;

    if (marker === 0xe1) {
      const exifStart = offset + 4;
      if (getString(view, exifStart, 4) !== 'Exif') return null;

      const tiffStart = exifStart + 6;
      const byteOrder = view.getUint16(tiffStart);
      const littleEndian = byteOrder === 0x4949;
      if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
      if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return null;

      const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const ifd0 = readTags(view, tiffStart, tiffStart + firstIfdOffset, TAGS_IFD0, littleEndian) as ExifParseResult;

      const result: ParsedExif = {
        datetimeOriginal: null,
        latitude: null,
        longitude: null
      };

      if (typeof ifd0.ExifOffset === 'number') {
        const exifTags = readTags(view, tiffStart, tiffStart + ifd0.ExifOffset, TAGS_EXIF, littleEndian) as ExifParseResult;
        if (typeof exifTags.datetimeOriginal === 'string' && exifTags.datetimeOriginal) {
          result.datetimeOriginal = exifTags.datetimeOriginal;
        }
      }

      if (typeof ifd0.GPSInfo === 'number') {
        const gps = readTags(view, tiffStart, tiffStart + ifd0.GPSInfo, TAGS_GPS, littleEndian) as GpsTags;
        result.latitude = toDecimalDegrees(gps.GPSLatitude, gps.GPSLatitudeRef);
        result.longitude = toDecimalDegrees(gps.GPSLongitude, gps.GPSLongitudeRef);
      }

      return result;
    }

    offset += 2 + segmentLength;
  }

  return null;
}

export function readAndParseExif(filePath: string): Promise<ParsedExif | null> {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath,
      success(res) {
        try {
          if (typeof res.data === 'string') {
            resolve(null);
            return;
          }
          resolve(parseExifFromArrayBuffer(res.data));
        } catch (error) {
          reject(error);
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}
