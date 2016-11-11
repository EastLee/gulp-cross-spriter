// gulp-cross-spriter: https://www.npmjs.com/package/gulp-cross-spriter
// Sprite Sheet Generation from CSS source files.

var fs = require('fs-extra');
var path = require('path');

var Promise = require('bluebird');
var outputFile = Promise.promisify(fs.outputFile);
var stat = Promise.promisify(fs.stat);

var through = require('through2');
var extend = require('extend')
var gutil = require('gulp-util');

var css = require('css');
var spritesmith = require('spritesmith');
var spritesmithBuild = Promise.promisify(spritesmith);

var spriterUtil = require('./lib/spriter-util');
var getBackgroundImageDeclarations = require('./lib/get-background-image-declarations');
var transformFileWithSpriteSheetData = require('./lib/transform-file-with-sprite-sheet-data');

// consts
const PLUGIN_NAME = 'gulp-cross-spriter';

var spriter = function(options) {

    var defaults = {
        // ('implicit'|'explicit')
        'includeMode': 'implicit',
        // 雪碧图合成之后图片存放的路径，不包括图片名字
        'spriteSheet': '',
        //生成的雪碧图替换原来background中path的path，不包括名字
        'pathToSpriteSheetFromCSS': '',
        //生成css的路径，不加css文件名
        cssPath: '',
        //当做编译完成后的回调函数
        'spriteSheetBuildCallback': function(a, b) {},
        // If true, we ignore any images that are not found on disk
        // Note: this plugin will still emit an error if you do not verify that the images exist
        'silent': true,
        // Check to make sure each image declared in the CSS exists before passing it to the spriter.
        // Although silenced by default(`options.silent`), if an image is not found, an error is thrown.
        'shouldVerifyImagesExist': true,
        // Any option you pass in here, will be passed through to spritesmith
        // https://www.npmjs.com/package/spritesmith#-spritesmith-params-callback-
        'spritesmithOptions': {},
        // Used to format output CSS
        // You should be using a separate beautifier plugin
        'outputIndent': '\t'
    };

    var settings = extend({}, defaults, options);

    // Keep track of all the chunks that come in so that we can re-emit in the flush
    var chunkList = {};
    // We use an object for imageMap so we don't get any duplicates
    var imageMap = {};
    // Check to make sure all of the images exist(`options.shouldVerifyImagesExist`) before trying to sprite them
    var imagePromiseArray = [];

    var stream = through.obj(function(chunk, enc, cb) {
        // http://nodejs.org/docs/latest/api/stream.html#stream_transform_transform_chunk_encoding_callback

        // Each `chunk` is a vinyl file: https://www.npmjs.com/package/vinyl
        // chunk.cwd
        // chunk.base
        // chunk.path
        // chunk.contents
        if (chunk.isStream()) {
            self.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Cannot operate on stream'));
        } else if (chunk.isBuffer()) {
            var contents = String(chunk.contents);

            var styles;
            try {
                styles = css.parse(contents, {
                    'silent': settings.silent,
                    'source': chunk.path
                });
            } catch (err) {
                err.message = 'Something went wrong when parsing the CSS: ' + err.message;
                self.emit('log', err.message);

                // Emit an error if necessary
                if (!settings.silent) {
                    self.emit('error', err);
                }
            }

            // Gather a list of all of the image declarations
            var chunkBackgroundImageDeclarations = getBackgroundImageDeclarations(styles, settings.includeMode);

            // Go through each declaration and gather the image paths
            // We find the new images that we found in this chunk verify they exist below
            //		We use an object so we don't get any duplicates
            var newImagesfFromChunkMap = {};
            var backgroundURLMatchAllRegex = new RegExp(spriterUtil.backgroundURLRegex.source, "gi");
            chunkBackgroundImageDeclarations.forEach(function(declaration) {
                // Match each background image in the declaration (there could be multiple background images per value)
                spriterUtil.matchBackgroundImages(declaration.value, function(imagePath) {

                    imagePath = path.join(path.dirname(chunk.path), imagePath);

                    // If not already in the overall list of images collected
                    // Add to the queue/list of images to be verified
                    if (!imageMap[imagePath]) {
                        newImagesfFromChunkMap[imagePath] = true;
                    }

                    // Add it to the main overall list to keep track
                    imageMap[imagePath] = true;

                });
            });

            // Filter out any images that do not exist depending on `settings.shouldVerifyImagesExist`
            Object.keys(newImagesfFromChunkMap).forEach(function(imagePath) {
                var filePromise;
                if (settings.shouldVerifyImagesExist) {
                    filePromise = stat(imagePath.split('?')[0]).then(function() {
                        return {
                            doesExist: true,
                            path: imagePath
                        };
                    }, function() {
                        return {
                            doesExist: false,
                            path: imagePath
                        };
                    });
                } else {
                    // If they don't want us to verify it exists, just pass it on with a undefined `doesExist` property
                    filePromise = Promise.resolve({
                        doesExist: undefined,
                        path: imagePath
                    });
                }

                imagePromiseArray.push(filePromise);
            });

            // Keep track of each chunk and what declarations go with it
            // Because the positions/line numbers pertain to that chunk only
            var chunkPathReg = /^.*\/(.*?)\.(?:css)$/;
            var chunkKey = chunkPathReg.exec(chunk.path)[1];
            if (!chunkList[chunkKey]) {
                chunkList[chunkKey] = chunk;
            }
        }

        // "call callback when the transform operation is complete."
        cb();

    }, function(cb) {
        // http://nodejs.org/docs/latest/api/stream.html#stream_transform_flush_callback
        //console.log('flush');
        var self = this;

        // Create an verified image list when all of the async checks have finished
        var imagesVerifiedPromise = Promise.settle(imagePromiseArray).then(function(results) {
            var imageList = {};
            var reg = /^(.*?)\.(.*?)\?sprite=(.*?)$/;
            Array.prototype.forEach.call(results, function(result) {
                imageInfo = result.value();
                if (imageInfo.doesExist === true || imageInfo.doesExist === undefined) {
                    var arr = reg.exec(imageInfo.path);
                    var imageCall = arr[3] + '.' + arr[2];
                    var imageListArr = imageList[imageCall] || (imageList[imageCall] = []);
                    imageListArr.push(arr[1] + '.' + arr[2]);
                } else {
                    // Tell them that we could not find the image
                    var logMessage = 'Image could not be found: ' + imageInfo.path;
                    self.emit('log', logMessage);

                    // Emit an error if necessary
                    if (!settings.silent) {
                        self.emit('error', new Error(logMessage));
                    }
                }
            });

            return imageList;
        });


        // Start spriting once we know the true list of images that exist
        imagesVerifiedPromise.then(function(imageListObj) {

            function buildPromise() {
                var arr = [];
                // Generate the spritesheet
                for (var key in imageListObj) {
                    arr.push(handleImage(key, imageListObj[key]));
                }

                return arr;
            };

            Promise.all(buildPromise()).then(function(v) {
                var transformedChunk;
                v.forEach(function(v) {
                    var obj = {};
                    var _n = v.key.split('.')[0];
                    for (var i in v.coordinates) {
                        obj[i + '?sprite=' + _n] = v.coordinates[i];
                    }
                    var str = settings.pathToSpriteSheetFromCSS.substr(-1, 1) == '/' ? settings.pathToSpriteSheetFromCSS + v.key : settings.pathToSpriteSheetFromCSS + '/' + v.key;
                    transformedChunk = transformFileWithSpriteSheetData(chunkList, obj, v.key, str, settings.includeMode, settings.silent, settings.outputIndent);
                });

                return transformedChunk;
            }).then(function(transformedChunk) {
                var chunkStream = '';
                var cssPath = settings.cssPath.substr(-1, 1) == '/' ? settings.cssPath : settings.cssPath + '/';
                for (var i in transformedChunk) {
                    fs.outputFile(cssPath + i + '.css', transformedChunk[i].contents, function(err) {
                        console.info(err ? err.message : '编译文件成功');
                    });
                    chunkStream = chunkStream + transformedChunk[i];
                }
                return chunkStream;
            }).then(function(chunkStream) {
                self.push(chunkStream);
                var func = settings.spriteSheetBuildCallback;
                if (typeof func == 'function') {
                    func();
                }
            }).catch(function(err){
                console.log('发生错误！', err);
            })


            function handleImage(key, imageList) {
                var spritesmithOptions = extend({}, settings.spritesmithOptions, {
                    src: imageList
                });

                var spriteSmithBuildPromise = spritesmithBuild(spritesmithOptions);

                return spriteSmithBuildPromise.then(function(result) {

                    var str = settings.spriteSheet.substr(-1, 1) == '/' ? settings.spriteSheet + key : settings.spriteSheet + '/' + key;
                    fs.outputFile(str, result.image, 'binary');
                    result.key = key;
                    return result;

                }, function(err) {
                    if (err) {
                        err.message = 'Error creating sprite sheet image:\n' + err.message;
                        self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
                    }
                });
            }
        });
    });

    // returning the file stream
    return stream;
};


module.exports = spriter;
