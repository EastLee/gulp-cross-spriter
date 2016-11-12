# gulp-cross-spriter

生成雪碧图是前端开发中一个重要的流程，开源项目中有众多的此类插件，但是都是只满足部分要求，`gulp-cross-spriter`改装自`gulp-css-spriter`，可以做到多文件之间交叉合并雪碧图。

# 优点

* 可以选择合并的图片，不需要合并的不合并
* 可以在多文件之间选择性的合并想要合并的图片
* 支持在css文件中命名雪碧图

# 缺点

目前这一版本不支持继续pipe，所以在`gulp-cross-spriter`处理之前，最好把所有对css的处理做完，把`gulp-cross-spriter`处理当做最后一步，所以输出文件也是`gulp-cross-spriter`自动完成的！！！

# 安装

`npm install gulp-cross-spriter`

# 关于

* `gulp-cross-spriter`改装自[gulp-css-spriter](https://www.npmjs.com/package/gulp-css-spriter)，满足作者的需求

* `gulp-css-spriter` 使用 [spritesmith](https://www.npmjs.com/package/spritesmith)

# 用法
```css
.con{
	width: 1000px;
	height: 1000px;
	background-image: url("../img/flux0.png?sprite=index");
}
.com{
	width: 1000px;
	height: 1000px;
	background-image: url("../img/flux1.png?sprite=main");
}
```

```js
var gulp = require('gulp');
var spriter = require('gulp-cross-spriter');

gulp.task('css', function() {
	return gulp.src('./src/css/styles.css')//源文件的路径，可以是多文件
		.pipe(spriter({
			//以上面的css为例，合成后的雪碧图名字分别为index和main，插件会自动拼接到下面的路径
			'spriteSheet': './dist/img',//生成雪碧图存放的路径

			'pathToSpriteSheetFromCSS': '../img',//替换原来图片的路径后的雪碧图在css中的路径

			'cssPath': './dist/css',//生成css文件的路径，会把多个文件放在一个目录下

			'spritesmithOptions': {
                'algorithm': "top-down",
                'padding': 50
            }//参考spritesmith的配置

		}))
});
```

# Options

### css规则

`background`或者`background-image`中url的路径后面拼接`sprite=雪碧图的名字`

* 存在`sprite=雪碧图的名字`这种拼接字符串的，判定为需要合并的图片，没有的，判定为不需要合并
* 多文件之间以名字为标识，相同雪碧图名字的图片就会合并在一起，

### js规则

 - `options`: 对象
 	 - `spriteSheet`: string - 保存雪碧图的路径，不加雪碧图名字，因为sprite的值就是雪碧图的名字
 	 	 - 无默认值: 必填
 	 - `pathToSpriteSheetFromCSS`: string - 生成雪碧图后，雪碧图在css中显示的路径，不加雪碧图名字。雪碧图生成后插件会自动替换原css文件中`background`或者`background-image`中url的路径。
 	 	 - 无默认值: 必填
 	 - `spriteSheetBuildCallback`: function - 编译完成后的回调函数
 	 - `spritesmithOptions`: object - 传给spritesmith的参数 [阅读 spritesmith文档](https://www.npmjs.com/package/spritesmith#-spritesmith-params-callback-)
 	 	 - 默认值: {}
		 - algorithm：top-down|left-right|diagonal|alt-diagonal|binary-tree
		 - padding: number
 	 - `cssPath`: string - 生成css的路径，css名字沿用源文件名字，如果想改名，在此插件之前完成
 	 	 - 无默认值: 必填

以上路径都是相对路径，相关配置参数可以参考[spritesmith](https://www.npmjs.com/package/spritesmith)和[gulp-css-spriter](https://www.npmjs.com/package/gulp-css-spriter)

# 感谢

感谢[hello-sunbaixin](https://github.com/hello-sunbaixin)和[leeww](https://github.com/leeww)提供的需求和建议！
