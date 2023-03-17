// Initialize modules
var gulp = require("gulp");
var cssnano = require("gulp-cssnano");
var concat = require("gulp-concat");
var uglify = require("gulp-uglify");

gulp.task("css", function () {
  return gulp
    .src(["public_assets/*.css"])
    .pipe(concat("product-slider.css"))
    .pipe(cssnano())
    .pipe(gulp.dest("public"));
});

gulp.task("js", function () {
  return gulp
    .src(["public_assets/*.js"])
    .pipe(concat("product-slider.js"))
    .pipe(uglify())
    .pipe(gulp.dest("public"));
});

gulp.task("watch", function () {
  gulp.watch("public_assets/*.css", gulp.series("css"));
  gulp.watch("public_assets/*.js", gulp.series("js"));
});

gulp.task("default", gulp.series("css", "js", "watch"));
