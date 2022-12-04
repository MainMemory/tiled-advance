var projpath = FileInfo.cleanPath(FileInfo.joinPaths(FileInfo.path(FileInfo.fromNativeSeparators(__filename)), ".."));
var romtxt = FileInfo.joinPaths(projpath, "romfile.txt");
const baseOffset = 0x8000000;
const levelTable = 0xD0624;

var getROMFile = function()
{
	if (File.exists(romtxt)) {
		var txtfile = new TextFile(fileName, TextFile.ReadOnly);
		var rom = txtfile.readAll();
		txtfile.close();
		return rom;
	}
	return FileInfo.joinPaths(projpath, "sadv3.gba");
}

var getPointer = function(data, address)
{
	var tmp = data.getUint32(address, true);
	if (tmp != 0)
		tmp -= baseOffset;
	return tmp;
}

var getLayerInfo = function(data, address)
{
	return {
		unknown1: data.getUint16(address, true),
		unknown2: data.getUint16(address + 2, true),
		aniTileSize: data.getUint16(address + 4, true),
		animFrameCount: data.getUint8(address + 6),
		animDelay: data.getUint8(address + 7),
		tiles: getPointer(data, address + 8),
		tileSize: data.getUint32(address + 0xC, true),
		palette: getPointer(data, address + 0x10),
		palDest: data.getUint16(address + 0x14, true),
		palLength: data.getUint16(address + 0x16, true),
		chunks: getPointer(data, address + 0x18),
		layout: getPointer(data, address + 0x1C),
		width: data.getUint16(address + 0x20, true),
		height: data.getUint16(address + 0x22, true)
	};
}

var getBackgroundInfo = function(data, address)
{
	return {
		width: data.getUint16(address, true),
		height: data.getUint16(address + 2, true),
		unknown1: data.getUint16(address + 4, true),
		unknown2: data.getUint16(address + 6, true),
		tiles: getPointer(data, address + 8),
		tileSize: data.getUint32(address + 0xC, true),
		palette: getPointer(data, address + 0x10),
		palDest: data.getUint16(address + 0x14, true),
		palLength: data.getUint16(address + 0x16, true),
		layout: getPointer(data, address + 0x18)
	};
}

var getLevelInfo = function(data, zone, act)
{
	var addr = levelTable + ((zone * 10 + act) * 0x10);
	var result = {};
	var ptr = getPointer(data, addr);
	if (ptr != 0)
		result.foregroundHigh = getLayerInfo(data, ptr);
	var ptr = getPointer(data, addr + 4);
	if (ptr != 0)
		result.foregroundLow = getLayerInfo(data, ptr);
	var ptr = getPointer(data, addr + 8);
	if (ptr != 0)
		result.background1 = getBackgroundInfo(data, ptr);
	var ptr = getPointer(data, addr + 0xC);
	if (ptr != 0)
		result.background2 = getBackgroundInfo(data, ptr);
	return result;
}

var getTilemapImage = function(data, cnkaddr, width, height, tiladdr, palette)
{
	var pxw = width * 8;
	var pxh = height * 8;
	var pix = new Uint8Array(pxw * pxh);
	for (var cy = 0; cy < height; ++cy) {
		for (var cx = 0; cx < width; ++cx) {
			var tinf = data.getInt16(cnkaddr, true);
			cnkaddr += 2;
			var pal = (tinf & 0xF000) >> 8;
			var toff = tiladdr + ((tinf & 0x3FF) * 0x20);
			switch (tinf & 0xC00)
			{
				case 0:
					for (var y = 0; y < 8; ++y) {
						for (var x = 0; x < 8; x += 2) {
							var p = data.getUint8(toff++);
							pix[((cy * 8) + y) * pxw + (cx * 8) + x] = pal | (p & 0xF);
							pix[((cy * 8) + y) * pxw + (cx * 8) + x + 1] = pal | (p >> 4);
						}
					}
					break;
				case 0x400:
					for (var y = 0; y < 8; ++y) {
						for (var x = 6; x >= 0; x -= 2) {
							var p = data.getUint8(toff++);
							pix[((cy * 8) + y) * pxw + (cx * 8) + x + 1] = pal | (p & 0xF);
							pix[((cy * 8) + y) * pxw + (cx * 8) + x] = pal | (p >> 4);
						}
					}
					break;
				case 0x800:
					for (var y = 7; y >= 0; --y) {
						for (var x = 0; x < 8; x += 2) {
							var p = data.getUint8(toff++);
							pix[((cy * 8) + y) * pxw + (cx * 8) + x] = pal | (p & 0xF);
							pix[((cy * 8) + y) * pxw + (cx * 8) + x + 1] = pal | (p >> 4);
						}
					}
					break;
				case 0xC00:
					for (var y = 7; y >= 0; --y) {
						for (var x = 6; x >= 0; x -= 2) {
							var p = data.getUint8(toff++);
							pix[((cy * 8) + y) * pxw + (cx * 8) + x + 1] = pal | (p & 0xF);
							pix[((cy * 8) + y) * pxw + (cx * 8) + x] = pal | (p >> 4);
						}
					}
					break;
			}
		}
	}
	var img = new Image(pix.buffer, pxw, pxh, Image.Format_Indexed8);
	img.setColorTable(palette);
	return img;
}

var readPalette = function(data, info, palette)
{
	var paladdr = info.palette;
	if (paladdr == 0)
		return;
	for (var pi = 0; pi < info.palLength; ++pi) {
		var c = data.getUint16(paladdr, true);
		paladdr += 2;
		var tmp = c & 0x1F;
		var r = (tmp >> 2) | (tmp << 3);
		tmp = (c >> 5) & 0x1F;
		var g = (tmp >> 2) | (tmp << 3);
		tmp = (c >> 10) & 0x1F;
		var b = (tmp >> 2) | (tmp << 3);
		palette[pi + info.palDest] = (r << 16) | (g << 8) | b;
		if ((pi + info.palDest) & 0xF)
			palette[pi] |= 0xFF000000;
	}
}