// Original synthetic CLI compatibility fixture. No user SCAD is executed.
/* [Palette] */
paint_hex = "#112233";
paint_rgb = [0.2, 0.3, 0.4];
paint_rgba = [0.6, 0.4, 0.2, 0.75];
/* [Geometry] */
width = 5;
position = [9, 0, 0];

echo("PT_HEX", paint_hex);
echo("PT_RGB", paint_rgb);
echo("PT_RGBA", paint_rgba);
echo("PT_WIDTH", width);
echo("PT_POSITION", position);
color(paint_hex) translate([1, 0, 0]) cube([width, 2, 1], center=false);
color(paint_rgb) translate(position) cube([width, 2, 1], center=false);
color(paint_rgba) translate(2 * position) cube([width, 2, 1], center=false);
