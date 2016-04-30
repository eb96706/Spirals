
var WV = {};

WV.screenSpaceEventHandler = null;
WV.prevEndId = null;
WV.numBillboards = 0;
WV.bbScaleUnselected = 0.08;
WV.bbScaleSelected = 0.12;
WV.currentBillboard = null;
WV.keepSending = true;
WV.layers = {};
WV.viewer = null;
WV.scene = null;
WV.thisPersonData = null;
WV.origin = [0,0];
WV.curPos = null;
WV.myId = "_anon_"+new Date().getTime();
WV.numPolls = 0;
var wvCom = null;

WV.viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider : new Cesium.ArcGisMapServerImageryProvider({
        url : 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
    }),
    baseLayerPicker : false
});
WV.entities = WV.viewer.entities;
WV.scene = WV.viewer.scene;				 
WV.scene.globe.depthTestAgainstTerrain = true;


WV.LAYER_DATA =
{
    "layers": [
       {
          'name': 'drones',
          'description': 'drone videos',
	  'maxNum': 100,
	  'visible': false,
       },
       {
          'name': 'photos',
          'description': 'recently tweeted images',
	  'maxNum': 100,
	  'imageServer': 'http://localhost:8001/'
       },
       {
          'name': 'people',
          'description': 'people watching now',
	  'maxNum': 100,
       },
       {
          'name': 'indoorMaps',
          'description': 'indoor maps',
       }
    ]
};


WV.getLocation = function() {
    if (navigator.geolocation) {
        var ret = navigator.geolocation.getCurrentPosition(WV.handleLocation);
        report("ret: "+ret);
    } else {
        report("Geolocation is not supported by this browser.");
    }
}

WV.handleLocation = function(position) {
    var lat = position.coords.latitude;
    var lon = position.coords.longitude;
    WV.origin = [lat,lon];
    report("lat: " + lat + "lon: " + lon);
    report("pos: "+JSON.stringify(position));
    WV.thisPersonData = { 'op': 'create', 'id': 'person0', 'origin': WV.origin };
}

function WVLayer(spec)
{
    var name = spec.name;
    for (var key in spec) {
	this[key] = spec[key];
    }
    this.spec = spec;
    this.numObjs = 0;
    this.recs = null;
    this.billboards = null;
    this.bbCollection = null;
    WV.layers[name] = this;

    this.loaderFun = function() {
	if (this.name == "photos")
	    getTwitterImages();
	if (this.name == "drones")
	    wvCom.subscribe("drones", handleDroneRecs);
	if (this.name == "people")
	    watchPeople();
	if (this.name == "indoorMaps")
	    getIndoorMapData();
    }

    this.setVisibility = function(visible) {
	this.visible = visible;
	report("setVisibility "+this.name+" "+visible);
	if (visible) {
	    if (this.billboards == null) {
		this.loaderFun();
	    }
	    else {
		setObjsAttr(this.billboards, "show", true);
	    }
	}
	else {
	    setObjsAttr(this.billboards, "show", false);
	}
        var id = "cb_"+this.name;
	$("#"+id).prop('checked', this.visible);
    }

    if (this.visible) {
	this.setVisibility(true);
    }
}

function report(str)
{
    console.log(str);
}

function addBillboard(bbCollection, lat, lon, imgUrl, id, scale, height)
{
    WV.numBillboards++;
    report("Adding billboard "+WV.numBillboards);
    // Example 1:  Add a billboard, specifying all the default values.
    if (!imgUrl)
       imgUrl = MONACAT_URL;
    if (!scale)
       scale = WV.bbScaleUnselected;
    if (!height)
       height = 1000000;
    var b = bbCollection.add({
       show : true,
       position : Cesium.Cartesian3.fromDegrees(lon, lat, height),
       pixelOffset : Cesium.Cartesian2.ZERO,
       eyeOffset : Cesium.Cartesian3.ZERO,
       horizontalOrigin : Cesium.HorizontalOrigin.CENTER,
       verticalOrigin : Cesium.VerticalOrigin.CENTER,
       'scale' : scale,
       image : imgUrl,
       color : Cesium.Color.WHITE,
       id : id
    });
    bb = b;//to make debugging easier..
    return b;
}


function handleDroneRecs(data)
{
    report("handleDroneRecs");
    var layer = WV.layers["drones"];
    layer.recs = {};
    layer.billboards = {};
    layer.bbCollection = new Cesium.BillboardCollection();
    WV.scene.primitives.add(layer.bbCollection);
    var recs = data;
    for (var i=0; i<recs.length; i++) {
        var rec = recs[i];
	if (!rec.yahooId) {
            report("skipping recs with no yahoo video");
        }
        //report("rec "+i+" "+JSON.stringify(rec));
        if (!rec.yahooId)
            continue;
        layer.numObjs++;
        if (layer.numObjs > layer.maxNum)
            return;
        var imageUrl = "drone.png";
        var lon = rec.lon;
        var lat = rec.lat;
        id = "tbd_"+rec.id;
        layer.recs[id] = rec;
        var b = addBillboard(layer.bbCollection, lat, lon, imageUrl, id);
        layer.billboards[id] = b;
    }
}

function watchPeople()
{
    var data = [
       {
	   'op': 'create',
	   'id': 'person1', 
	   'origin': [0, 0],
	   'curPos': [0, 0, 1000000]
       }
    ]
    if (WV.thisPersonData)
	data.push(WV.thisPersonData);
    handlePeopleData(data);
    wvCom.subscribe("people", handlePeopleData);
}

function handlePeopleData(data)
{
    report("handlePeopleData");
    var layer = WV.layers["people"];
    if (layer.recs == null) {
	report("initing PeopleData layer");
	layer.recs = {};
	layer.tethers = {};
	layer.originBillboards = {};
	layer.curPosBillboards = {};
	layer.bbCollection = new Cesium.BillboardCollection();
	WV.scene.primitives.add(layer.bbCollection);
    }
    var originImageUrl = "person0.png";
    var curPosImageUrl = "eagle1.png";
    var recs = data;
    var t = getClockTime();
    for (var i=0; i<recs.length; i++) {
        var rec = recs[i];
        //report("rec "+i+" "+JSON.stringify(rec));
        layer.numObjs++;
	if (rec.origin == null) {
	    report("no origin");
	    continue;
	}
	if (rec.curPos == null) {
	    report("no curPos");
	    continue;
	}
	var dt = t - rec.t;
	if (dt > 30) {
	    report("ignoring view that is too old...");
	    continue;
	}
        var lat0 =   rec.origin[0];
        var lon0 =   rec.origin[1];
	var height0 = 30000;
        var lat =    rec.curPos[0];
        var lon =    rec.curPos[1];
	var height = rec.curPos[2];
        var id = "person_"+rec.id;
        //var id = "person_"+layer.numObjs;
        layer.recs[id] = rec;
	var scale = 0.25;
	//var height = 300000;
	var positions = [Cesium.Cartesian3.fromDegrees(lat0,lon0,height0),
			 //Cesium.Cartesian3.fromDegrees(lat,lon,height)];
			 Cesium.Cartesian3.fromDegrees(lat,lon,height)];
	var b = layer.originBillboards[id];
	if (b == null) {
	    report("add origin"+lat0+" "+lon0+" "+originImageUrl+" "+id+" "+scale+" "+height0);
	    var ob = addBillboard(layer.bbCollection, lat0, lon0, originImageUrl, id, scale, height0);
	    layer.originBillboards[id] = ob;
	    report("add curPos"+lat+" "+lon+" "+curPosImageUrl+" "+id+" "+scale+" "+height);
	    var cb = addBillboard(layer.bbCollection, lat, lon, curPosImageUrl, id, scale, height);
	    layer.curPosBillboards[id] = cb;
	    /*
	    var tether = WV.entities.add({
		    polyline : {
			positions : positions,
			    width : 5.0,
			    material : new Cesium.PolylineGlowMaterialProperty({
				    color : Cesium.Color.DEEPSKYBLUE,
					glowPower : 0.25
					})
			    }
		});
	    layer.tethers[id] = tether;
	    */
	}
	else {
	    report("billboard exists "+id);
	    var pos = Cesium.Cartesian3.fromDegrees(lon, lat, height);
	    report("set position "+pos);
	    layer.curPosBillboards[id].position = pos;
	    //layer.tethers[id].positions = positions;
	}
    }
}

function getIndoorMapData()
{
    var data = [
       {
          'id': 'map1', 
	  'latRange': [-115.0, -107],
	  'lonRange': [38.0,     39.75],
          'url': 'PorterFloorPlan.png',
	  'width': 100000,
	  'height': 100000,
       },
       {
          'id': 'map2', 
	  'latRange': [-105.0, -100],
	  'lonRange': [35.0,     38.0],
          'url': 'PorterFloorPlan.png',
	  'width': 100000,
	  'height': 100000,
       }

    ]
    handleIndoorMapData(data);
}

function handleIndoorMapData(data)
{
    report("handleIndoorMapData");
    var layer = WV.layers["indoorMaps"];
    var imageryLayers = WV.viewer.imageryLayers;
    layer.recs = {};
    layer.billboards = {};
    layer.ilayers = {};
    layer.bbCollection = new Cesium.BillboardCollection();
    var recs = data;
    for (var i=0; i<recs.length; i++) {
        var rec = recs[i];
        //report("rec "+i+" "+JSON.stringify(rec));
        var imageUrl = "person0.png";
        var lonLow = rec.lonRange[0];
        var lonHigh = rec.lonRange[1];
        var latLow = rec.latRange[0];
        var latHigh = rec.latRange[1];
        var id = rec.id;
        layer.recs[id] = rec;

        var provider = new Cesium.SingleTileImageryProvider({
	        //url : 'PorterFloorPlan.png',
	        url : rec.url,
                //rectangle : Cesium.Rectangle.fromDegrees(-115.0, 38.0, -107, 39.75)
                rectangle : Cesium.Rectangle.fromDegrees(latLow, lonLow, latHigh, lonHigh)
	});
        var ilayer = imageryLayers.addImageryProvider(provider);
        ilayer.alpha = 1.0;
        ilayer.show = true;
        ilayer.name = name;
        layer.ilayers[id] = ilayer;
    }
}

function setObjsAttr(objs, attr, val)
{
    report("setObjsAttr "+attr+" "+val+" objs: "+objs);
    for (id in objs) {
	//report("set objs["+id+"]."+attr+" = "+val);
	objs[id][attr] = val;
    }
}


function getTwitterImages(url)
{
    var layer = WV.layers["photos"];
    if (url) {
        WV.keepSending = false;
    }
    else {
        url = layer.imageServer+"imageTweets/?maxNum=10";
        if (WV.prevEndId)
            url += "&prevEndNum="+WV.prevEndId;
    }
    if (layer.billboards == null)
	layer.billboards = {};
    layer.bbCollection = new Cesium.BillboardCollection();
    WV.scene.primitives.add(layer.bbCollection);
    wvCom.subscribe("photos", handleImageRecs);
    //    report("downloadImageRecs "+url);
    //    $.getJSON(url, handleImageRecs)
}

//function handleImageRecs(data)
function handleImageRecs(recs)
{
    report("handleImageRecs");
    var layer = WV.layers["photos"];
    //data.images = data.images.slice(0,100);
    //var imageList = data.images;
    var imageList = recs;
    for (var i=0; i<imageList.length; i++) {
        layer.numObjs++;
        if (layer.numObjs > layer.maxNum)
            return;
        var ispec = imageList[i];
        //report(" i: "+i+"  "+JSON.stringify(ispec));
	var id = ispec.id;
        WV.prevEndId = id;
        var imageUrl = ispec.imageUrl;
        if (!imageUrl)
            imageUrl = layer.imageServer+"images/twitter_images/"+id+"_p2.jpg";
        //imageUrl = "image1.jpg";
        var lon = ispec.lonlat[0];
        var lat = ispec.lonlat[1];
        var b = addBillboard(layer.bbCollection, lat, lon, imageUrl, id);
        layer.billboards[id] = b;
	b._wvid = id;
	report("ispec: "+JSON.stringify(ispec));
    }
    //    if (WV.keepSending)				      
    //        setTimeout(getTwitterImages, 1000);
}


function setupCesium()
{
    // If the mouse is over the billboard, change its scale and color
    var handler = new Cesium.ScreenSpaceEventHandler(WV.scene.canvas);
    WV.screenSpaceEventHandler = handler;
    var layerName = "drones";
    //var layerName = "photos";
    handler.setInputAction(function(movement) {
        var pickedObject = WV.scene.pick(movement.endPosition);
	if (!Cesium.defined(pickedObject)) {
            if (WV.currentBillboard)
                WV.currentBillboard.scale = WV.bbScaleUnselected;
            WV.currentBillboard = null;
            return;
        }
	var layer = WV.layers[layerName];
        mpo = pickedObject;
        var id = pickedObject.id;
        report("move over id "+id);
        var b = layer.billboards[id];
        if (WV.currentBillboard && b != WV.currentBillboard) {
            WV.currentBillboard.scale = WV.bbScaleUnselected;
        }
        WV.currentBillboard = b;
        report("b.scale "+b.scale);
        b.scale = WV.bbScaleSelected;
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction(function(e) {
        report("click.....");
        var pickedObject = WV.scene.pick(e.position);
	if (!Cesium.defined(pickedObject)) {
            return;
        }
        cpo = pickedObject;
        var id = pickedObject.id;
	var layer = WV.layers[layerName];
        report("click picked..... pickedObject._id "+id);
        var rec = layer.recs[id];
        playVid(rec);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
}

function playVid(rec)
{
    var yahooId = rec.yahooId;
    var url = "https://www.youtube.com/watch?v="+yahooId;
    setTimeout(function() {
        window.open(url, "DroneVidioView");
    }, 400);
}

function getLayers()
{
    setupLayers(WV.LAYER_DATA);
}

function setupLayers(layerData)
{
    var layers = layerData.layers;
    var layersDiv = $("#layersDiv");
    var cbList = $('<div />', { type: 'div', id: 'cbListDiv'}
                   ).appendTo(layersDiv);
    //var cbList = $("#cbListDiv");
    for (var i=0; i<layers.length; i++) {
        var layer = new WVLayer(layers[i]);
	var name = layer.name;
        var id = "cb_"+layer.name;
        var desc = layer.description;
        $('<input />',
            { type: 'checkbox', id: id, value: desc,
	      click: toggleLayerCB}).appendTo(cbList);
        $('<label />',
            { 'for': id, text: desc, style: "color:white" }).appendTo(cbList);
        $('<br />').appendTo(cbList);
    }
    $("#layersLabel").click(function(e) {
	    report("******** click *******");
            var txt = $("#layersLabel").html();
            report("txt: "+txt);
	    if (txt == "Hide Layers") {
		$("#layersLabel").html("Show Layers");
		cbList.hide();
	    }
	    else {
		$("#layersLabel").html("Hide Layers");
		cbList.show();
	    }
	});
}

function toggleLayerCB(e)
{
    report("e: "+e.target.id);
    var layer = e.target.id.slice(3);
    report("checked.... "+$("#"+e.target.id).is(":checked"));
    toggleLayer(layer);
}

function toggleLayer(layerName)
{
    report("toggleLayer "+layerName);
    var layer = WV.layers[layerName];
    var id = "cb_"+layerName;
    var checked = $("#"+id).is(":checked");
    report(" checked: "+checked);
    layer.setVisibility(checked);
}

function getClockTime()
{
    return new Date().getTime()/1000.0;
}

function toDegrees(r)
{
    return r*180/Math.PI;
}

function reporter()
{
//    report("reporter");
    var cpos = WV.viewer.camera.positionCartographic;
    var clat = toDegrees(cpos.latitude);
    var clon = toDegrees(cpos.longitude);
    WV.curPos = [clat, clon, cpos.height];
    var t = getClockTime();
    WV.numPolls++;
    var status = {
	'type': 'people',
	'id': WV.myId,
	'origin': WV.origin,
	'curPos': WV.curPos,
	't': t,
	'n': WV.numPolls};
    wvCom.sendStatus(status);
    setTimeout(reporter, 1000);
}

$(document).ready(function() {
    report("Starting...");
    wvCom = new WV.WVCom();
    getLayers();
    setupCesium();
    WV.getLocation();
    setTimeout(reporter, 1000);
});
