#!/usr/bin/env node


// generic utilities

// takes an RGB value and converts it to a single grayscale value
var convertToGrayscale = function(r,g,b) {
  return (r * 0.2989) + (g * 0.5870) + (b * 0.1140)
}

// allows you to normalize numbers on a scale
// in this case, we take grayscale values from 0 to 255
// and scale them to be from 0 to 15.
//
// Ideally, you could write your own function here to tweak the
// grayscale values as needed if a linear approach doesn't work
// when the lithophanes are printed.
//

var normalizeValue = function (val, from, to) {
  return (to-1) - Math.floor(val * to / from);
}





// image processing functions

// function that takes an ndarray of pixel data and converts it to a
// simpler array of data that represents the physical height of the values.
//
var getImageHeights = function(d) {

  var result = {
    data: []
  };

  // GIFs pass in an extra parameter for frames which
  // we're ignoring, but it requires us to use different
  // values for grabbing the data.  Other than that, the
  // logic is the same

  if (d.dimension == 4) {

    result.width = d.shape[1]
    result.height = d.shape[2]

    for (var i=0; i<result.width; i++) {
      result.data.push([]);

      // for each pixel, get its grayscale value, normalize it from 0-15
      // and add it to the array
      for (var j=0; j<result.height; j++) {
        var g = convertToGrayscale(d.get(0,i,j,0), d.get(0,i,j,1), d.get(0,i,j,2));
        result.data[i][j] = normalizeValue(g, 256, 16);
      }
    }

  } else {

    result.width = d.shape[0]
    result.height = d.shape[1]

    for (var i=0; i<result.width; i++) {
      result.data.push([]);

      // for each pixel, get its grayscale value, normalize it from 0-15
      // and add it to the array
      for (var j=0; j<result.height; j++) {
        var g = convertToGrayscale(d.get(i,j,0), d.get(i,j,1), d.get(i,j,2));
        result.data[i][j] = normalizeValue(g, 256, 16);
      }
    }

  }

  return result;
}







var getModelAreas = function(d) {

  // these values are based on settings in the 3D printer

  var border = 1.0
  var base = 0.4      // means the model will always have a 0.4mm base
  var scale = 0.2     // each of the 10 layers will be 0.2 mm in height
  var zenith = base + (scale*10);
  var maxWidth = scale*d.width;
  var maxHeight = scale*d.height;
  var areas = [];

  for (var w=0; w<d.width; w++) {

    for (var h=0; h<d.height; h++) {

      // for each pixel, you're creating a box that's as high as its grayscale
      // value.  Rather than make tens of thousands of boxes and union them all
      // we're individually mapping each of the faces of the resulting object

      var x0 = w*scale;
      var x1 = x0 + scale;
      var y0 = h*scale;
      var y1 = y0 + scale;
      var z0 = 0;
      var z1 = parseFloat((base + (scale * d.data[w][h])).toFixed(1));

      // back face (bottom of the model)
      areas.push([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]])

      // front face
      areas.push([[x0,y0,z1],[x0,y1,z1],[x1,y1,z1],[x1,y0,z1]])

      // top border wall
      if (h == 0) {

        var t = [];
        t.push([x1,y0,z0])
        t.push([x0,y0,z0]);

        if (w > 0) {
         if (d.data[w][h] > d.data[w-1][h]) {
           t.push([x0, y0, (scale * d.data[w-1][h]) ])
         }
        }

        t.push([x0,y0,z1])
        t.push([x1,y0,z1])

        if (w<(d.width-1)) {
          if (d.data[w][h] > d.data[w+1][h]) {
            t.push([x1, y0, (scale * d.data[w+1][h]) ])
          }
        }

        areas.push(t);

      }

      // left border wall
      if (w == 0) {

        var t = [];
        t.push([x0,y1,z1])
        t.push([x0,y0,z1]);

        if (h > 0) {
          if (d.data[w][h] > d.data[w][h-1]) {
            t.push([x0, y0, (scale * d.data[w][h-1]) ])
          }
        }

        t.push([x0,y0,z0])
        t.push([x0,y1,z0])

        if (h<(d.height-1)) {
          if (d.data[w][h] > d.data[w][h+1]) {
            t.push([x0, y1, (scale * d.data[w][h+1]) ])
          }
        }

        areas.push(t);

      }

      // bottom face of each pixel
      if (h == (d.height-1)) {

        // if we're on the last row, treat it like a border
        var t = [];
        t.push([x1,y1,z1])
        t.push([x0,y1,z1]);

        if (w > 0) {
          if (d.data[w][h] > d.data[w-1][h]) {
            t.push([x0, y1, (scale * d.data[w-1][h]) ])
          }
        }

        t.push([x0,y1,z0])
        t.push([x1,y1,z0])

        if (w<(d.width-1)) {
          if (d.data[w][h] > d.data[w+1][h]) {
            t.push([x1, y1, (scale * d.data[w+1][h]) ])
          }
        }

        areas.push(t);


      } else {

        // just connect it to the next pixel

        if (d.data[w][h] != d.data[w][h+1]) {
          var z2 = base + (scale * d.data[w][h+1])
          areas.push([[x1, y1, z1], [x0,y1,z1], [x0,y1,z2], [x1,y1,z2]])
        }

      }



      // right face of each pixel

      if (w == (d.width-1)) {

        // if we're on the last row, make it a solid right border

        var t = [];
        t.push([x1,y1,z0])
        t.push([x1,y0,z0]);

        if (h > 0) {
          if (d.data[w][h] > d.data[w][h-1]) {
            t.push([x1, y1, (scale * d.data[w][h-1]) ])
          }
        }

        t.push([x1,y0,z1])
        t.push([x1,y1,z1])

        if (h<(d.height-1)) {
          if (d.data[w][h] > d.data[w][h+1]) {
            t.push([x1, y1, (scale * d.data[w][h+1]) ])
          }
        }

        areas.push(t);


      } else {

        // just connect it to the next pixel

        if (d.data[w][h] != d.data[w+1][h] ) {
          var z2 = base + (scale * d.data[w+1][h])
          areas.push([[x1, y0, z1], [x1, y1, z1], [x1, y1, z2], [x1, y0, z2] ])
        }

      }


    }

  }

  return areas;
}







// takes an array of point arrays and converts them into sets of triangles
//
// TODO: right now I only have this hardcoded for flat areas containing 3-7
// points around the perimeter, so this should probably be re-written as
// a more generic algorithm that can take arrays of n points and convert to
// triangles
//

var areasToTriangles = function(areas) {

  triangles = [];
  var routes = [
    0,
    0,
    0,
    [[0,1,2]],
    [[0,1,2], [0,2,3]],
    [[0,1,4], [1,2,4], [2,3,4]],
    [[0,1,2], [2,3,5], [3,4,5], [5,0,2]]
  ]

  for (var a in areas) {

    var l = areas[a].length;
    if ((l >= 3) && (l <= 6)) {

      for (var i in routes[l]) {

        triangles.push([
          areas[a][routes[l][i][0]],
          areas[a][routes[l][i][1]],
          areas[a][routes[l][i][2]]
        ]);

      }

    }
  }

  return triangles;

}




// takes an array of triangles and writes them to a file
// using the standard STL ASCII format

var createASCIISTL = function (triangles) {

  var str = "solid lithograph\n"

  for (var i in triangles) {
    str += "  facet normal 0.0 0.0 0.0\n"
    str += "    outer loop\n"
    str += "      vertex " + triangles[i][0][0] + " " + triangles[i][0][1] + " " + triangles[i][0][2] + "\n"
    str += "      vertex " + triangles[i][1][0] + " " + triangles[i][1][1] + " " + triangles[i][1][2] + "\n"
    str += "      vertex " + triangles[i][2][0] + " " + triangles[i][2][1] + " " + triangles[i][2][2] + "\n"
    str += "    endloop\n"
    str += "  endfacet\n"
  }

  str += "endsolid"

  var stream = fs.createWriteStream(program.outputFile, { flags : 'w' })
  stream.write(str)

}




// takes an array of triangles and writes them to a file
// using the standard STL binary format

var createBinarySTL = function (triangles) {

  var buffLength = 84 + (50 * triangles.length)

  var b = new Buffer(buffLength)

  // these 80 bytes are always ignored so you can put
  // whatever string you want in this space
  b.write('NodeJS Binary STL Writer', 0)
  b.writeUInt32LE(triangles.length, 80);

  var offset = 84

  for (var i in triangles) {

    b.writeFloatLE(0.0, offset);
    b.writeFloatLE(0.0, offset+4);
    b.writeFloatLE(0.0, offset+8);

    b.writeFloatLE(triangles[i][0][0], offset+12);
    b.writeFloatLE(triangles[i][0][1], offset+16);
    b.writeFloatLE(triangles[i][0][2], offset+20);

    b.writeFloatLE(triangles[i][1][0], offset+24);
    b.writeFloatLE(triangles[i][1][1], offset+28);
    b.writeFloatLE(triangles[i][1][2], offset+32);

    b.writeFloatLE(triangles[i][2][0], offset+36);
    b.writeFloatLE(triangles[i][2][1], offset+40);
    b.writeFloatLE(triangles[i][2][2], offset+44);

    b.writeUInt16LE(0, offset+48);

    offset += 50

  }

  var stream = fs.createWriteStream(program.outputFile, { flags : 'w' });
  stream.write(b)

}





// Process the image

var processImage = function(err, pixels) {

  if(err) {
    console.log("Couldn't find that image.  Is the path correct?")
    return
  }

  // convert the image into an array of heights representing grayscale values
  var heightData = getImageHeights(pixels);

  // convert those heights into a series of 3D rects in space
  var areas = getModelAreas(heightData);

  // parse those rects into triangles for rendering
  var triangles = areasToTriangles(areas);

  // output the triangles into STL format
  if (program.ascii) {
    createASCIISTL(triangles);
  } else {
    createBinarySTL(triangles);
  }

}





//
//
// Main Program flow
//
//

// import required libraries

// used to write the STL file locally
var fs = require('fs');

// used to read the pixel information from the images
var getPixels = require('get-pixels');

// used to make this a command line utility
var program = require('commander');

// set the command-line options
program
  .version('0.0.1')
  .option('-i, --image [path]', 'Path to image file (required)')
  .option('-o, --output-file [path]', 'STL output file (defaults to lithophane.stl)', String, 'lithophane.stl')
  .option('-a, --ascii', 'Export STL as ASCII instead of binary')
  .parse(process.argv);

// process the image if it exists
if (!program.image) {
  console.log("You must include an image path as a parameter. See ./lithophane.js -h for more details.")
} else {
  getPixels(program.image, processImage)
}
