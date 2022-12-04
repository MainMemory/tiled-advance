var readForegroundLayer = function(name, data, layinf, tileset)
{
	var layaddr = layinf.layout;
	var layer = new TileLayer(name);
	layer.width = layinf.width;
	layer.height = layinf.height;
	var fgedit = layer.edit();
	for (var y = 0; y < layer.height; ++y) {
		for (var x = 0; x < layer.width; ++x) {
			fgedit.setTile(x, y, tileset.tile(data.getUint16(layaddr, true)));
			layaddr += 2;
		}
	}
	fgedit.apply();
	return layer;
}

var writeForegroundLayer = function(data, layinf, layer)
{
	var layaddr = layinf.layout;
	for (var y = 0; y < layinf.height; ++y) {
		for (var x = 0; x < layinf.width; ++x) {
			var tile = layer.tileAt(x, y);
			var tid = 0;
			if (tile != null)
				tid = tile.id;
			data.setUint16(layaddr, tid, true);
			layaddr += 2;
		}
	}
}

var sa2lvMapFormat = {
    name: "Sonic Advance 2 Level",
    extension: "sa2lv",

	//Function for reading from a sa2lv file
	read: function(fileName) {
		var txtfile = new TextFile(fileName, TextFile.ReadOnly);
		var stginf = JSON.parse(txtfile.readAll());
		txtfile.close();

		var tilemap = new TileMap();
		tilemap.setTileSize(96, 96);

		var file = new BinaryFile(getROMFile(), BinaryFile.ReadOnly);
		var data = new DataView(file.readAll());
		file.close();
		var lvinf = getLevelInfo(data, stginf.zone, stginf.act);

		var w = 0;
		var h = 0;
		if (lvinf.foregroundLow != null) {
			w = lvinf.foregroundLow.width;
			h = lvinf.foregroundLow.height;
		}
		if (lvinf.foregroundHigh != null) {
			if (lvinf.foregroundHigh.width > w)
				w = lvinf.foregroundHigh.width;
			if (lvinf.foregroundHigh.height > h)
				h = lvinf.foregroundHigh.height;
		}
		tilemap.setSize(w, h);

		var tileset = new Tileset("Chunks");
		tileset.setTileSize(96, 96);
		var paladdr = lvinf.foregroundHigh.palette;
		var palette = new Array(256);
		for (var pi = 0; pi < 256; ++pi) {
			var c = data.getUint16(paladdr, true);
			paladdr += 2;
			var tmp = c & 0x1F;
			var r = (tmp >> 2) | (tmp << 3);
			tmp = (c >> 5) & 0x1F;
			var g = (tmp >> 2) | (tmp << 3);
			tmp = (c >> 10) & 0x1F;
			var b = (tmp >> 2) | (tmp << 3);
			palette[pi] = (r << 16) | (g << 8) | b;
			if (pi & 0xF)
				palette[pi] |= 0xFF000000;
		}
		var cnkaddr = lvinf.foregroundHigh.chunks;
		var cnkcnt = (lvinf.foregroundHigh.layout - cnkaddr) / (12 * 12 * 2);
		if (cnkcnt < 0 || cnkcnt > 512)
			cnkcnt = 512;
		for (var ci = 0; ci < cnkcnt; ++ci) {
			var tile = tileset.addTile();
			tile.setImage(getTilemapImage(
				data,
				cnkaddr,
				12,
				12,
				lvinf.foregroundHigh.tiles,
				palette));
			cnkaddr += 288;
		}
		tilemap.addTileset(tileset);

		if (lvinf.background != null) {
			var layer = new ImageLayer("Background");
			layer.image = getTilemapImage(
				data,
				lvinf.background.layout,
				lvinf.background.width,
				lvinf.background.height,
				lvinf.background.tiles,
				palette);
			tilemap.addLayer(layer);
		}

		if (lvinf.foregroundLow != null)
			tilemap.addLayer(readForegroundLayer("Foreground Low", data, lvinf.foregroundLow, tileset));
		if (lvinf.foregroundHigh != null)
			tilemap.addLayer(readForegroundLayer("Foreground High", data, lvinf.foregroundHigh, tileset));

		return tilemap;
	},


	write: function(map, fileName) {
		var txtfile = new TextFile(fileName, TextFile.ReadOnly);
		var stginf = JSON.parse(txtfile.readAll());
		txtfile.close();

		var file = new BinaryFile(getROMFile(), BinaryFile.ReadOnly);
		var data = new DataView(file.readAll());
		file.close();
		var lvinf = getLevelInfo(data, stginf.zone, stginf.act);

		for (var lid = 0; lid < map.layerCount; ++lid) {
			var layer = map.layerAt(lid);
			switch (layer.name)
			{
				case "Foreground High":
					if (layer.isTileLayer)
						writeForegroundLayer(data, lvinf.foregroundHigh, layer);
					break;
				case "Foreground Low":
					if (layer.isTileLayer)
						writeForegroundLayer(data, lvinf.foregroundLow, layer);
					break;
			}
		}

		var file = new BinaryFile(getROMFile(), BinaryFile.WriteOnly);
		file.write(data.buffer);
		file.commit();
	}

}

tiled.registerMapFormat("sa2lv", sa2lvMapFormat);
