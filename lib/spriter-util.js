
var backgroundURLRegex = (/(.*?url\(["\']?)(.*?\.(?:png|jpg|gif))(\?sprite\=.*?)(["\']?\).*?;?)/i);


function matchBackgroundImages(declarationValue, cb) {
	var backgroundURLMatchAllRegex = new RegExp(backgroundURLRegex.source, "gi");

	return declarationValue.replace(backgroundURLMatchAllRegex, function(match, p1, p2, p3,p4, offset, string) {
		var imagePath = p2;

		return p1 + cb(imagePath + p3) + p4;
	});
}



module.exports = {
	'backgroundURLRegex': backgroundURLRegex,
	'matchBackgroundImages':matchBackgroundImages
};
