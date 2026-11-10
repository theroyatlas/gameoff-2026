# Blender 4.4: the arena at the moment of the phase shift, following
# concepts/3d/01-miniature.png (walnut + brass board, glass/steel/brass balls,
# glass-domed core, brass cage monsters, warm desk light, cyan resonance web).
# Run: blender -b -P scene.py -- <shot: wide|hero> <out_dir>
import bpy, math, random, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SHOT = argv[0] if argv else 'wide'
OUT = argv[1] if len(argv) > 1 else '//'
random.seed(20261111)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x, scene.render.resolution_y = 1600, 900
scene.eevee.taa_render_samples = 96
scene.eevee.use_raytracing = True
scene.eevee.use_shadows = True
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'

CYAN = (0.25, 0.95, 0.9)
def mat(name, color, metal=0.0, rough=0.4, emit=None, strength=0.0, transmission=0.0, ior=1.45):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['Transmission Weight'].default_value = transmission
    b.inputs['IOR'].default_value = ior
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

def put(o, m):
    o.data.materials.append(m); return o

def bevel(o, w=0.04, seg=3):
    b = o.modifiers.new('bevel', 'BEVEL'); b.width = w; b.segments = seg; return o

walnut = mat('walnut', (0.16, 0.07, 0.03), rough=0.45)
desk = mat('desk', (0.10, 0.045, 0.02), rough=0.55)
brass = mat('brass', (0.85, 0.62, 0.3), metal=1.0, rough=0.22)
steel = mat('steel', (0.8, 0.8, 0.82), metal=1.0, rough=0.2)
glass = mat('glass', (0.95, 1.0, 1.0), rough=0.02, transmission=1.0)
glass.use_raytrace_refraction = True
glass.surface_render_method = 'DITHERED'
floor_glow = mat('floor', (0.035, 0.06, 0.06), rough=0.12, emit=CYAN, strength=0.06)
link_m = mat('link', CYAN, emit=CYAN, strength=3.5)
disc_m = mat('disc', CYAN, emit=CYAN, strength=1.2)
ink = mat('ink', (0.95, 0.88, 0.7), rough=0.6, emit=(0.95, 0.88, 0.7), strength=0.6)
core_m = mat('core', CYAN, emit=CYAN, strength=7)

world = bpy.data.worlds.new('World'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.16, 0.09, 0.05, 1)

# Desk
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -0.62)); put(bpy.context.object, desk)

# Board: walnut base, glowing glass floor, brass rim with cut corners
W, H = 16.0, 10.5
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.32)); base = bpy.context.object
base.scale = (W + 1.2, H + 1.2, 0.6); put(bevel(base, 0.08), walnut)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.0)); fl = bpy.context.object
fl.scale = (W, H, 0.04); put(fl, floor_glow)
for (x, y, sx, sy) in [(0, H/2 + 0.25, W + 0.2, 0.4), (0, -H/2 - 0.25, W + 0.2, 0.4), (W/2 + 0.25, 0, 0.4, H + 0.2), (-W/2 - 0.25, 0, 0.4, H + 0.2)]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.2)); r = bpy.context.object
    r.scale = (sx, sy, 0.45); put(bevel(r, 0.05), brass)
for sx in (-1, 1):
    for sy in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * (W/2 + 0.1), sy * (H/2 + 0.1), 0.25)); c = bpy.context.object
        c.scale = (1.0, 1.0, 0.5); c.rotation_euler.z = math.radians(45); put(bevel(c, 0.05), brass)
# rim rivets
for i in range(13):
    x = -W/2 + i * W / 12
    for y in (H/2 + 0.25, -H/2 - 0.25):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(x, y, 0.44)); put(bpy.context.object, brass)

# Core: brass ring base + glass dome + glowing heart
CORE = Vector((0, 0.3, 0))
bpy.ops.mesh.primitive_cylinder_add(radius=1.75, depth=0.35, location=CORE + Vector((0, 0, 0.17))); put(bevel(bpy.context.object, 0.05), brass)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1.45, location=CORE + Vector((0, 0, 0.35)), segments=64, ring_count=32); dome = bpy.context.object
put(dome, glass); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.35, location=CORE + Vector((0, 0, 0.9))); put(bpy.context.object, core_m)
for a in range(4):
    ang = a * math.pi / 2 + 0.4
    bpy.ops.mesh.primitive_cube_add(size=1, location=CORE + Vector((math.cos(ang) * 1.55, math.sin(ang) * 1.55, 0.75)))
    clamp = bpy.context.object; clamp.scale = (0.12, 0.12, 0.9); clamp.rotation_euler.z = ang; put(clamp, brass)

# Launcher at the near edge
LP = Vector((0, -H/2 + 0.6, 0))
bpy.ops.mesh.primitive_cylinder_add(radius=0.95, depth=0.7, location=LP + Vector((0, -0.4, 0.3))); put(bevel(bpy.context.object, 0.06), brass)
bpy.ops.mesh.primitive_cylinder_add(radius=0.65, depth=0.75, location=LP + Vector((0, -0.4, 0.32))); put(bpy.context.object, steel)
bpy.ops.mesh.primitive_torus_add(major_radius=0.8, minor_radius=0.03, location=LP + Vector((0, -0.4, 0.7))); put(bpy.context.object, link_m)

# Monsters: brass wire cages with a glowing heart, one per corner
cage_shapes = ['tetra', 'cube', 'ico', 'octa']
for (x, y), shape in zip([(-6.9, 4.0), (6.9, 4.0), (-6.9, -3.6), (6.9, -3.6)], cage_shapes):
    if shape == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=0.95, location=(x, y, 0.6))
    elif shape == 'ico':
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.6, location=(x, y, 0.6))
    elif shape == 'tetra':
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.7, depth=1.0, location=(x, y, 0.6))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.65, depth=1.1, location=(x, y, 0.6))
    cage = bpy.context.object
    wf = cage.modifiers.new('wire', 'WIREFRAME'); wf.thickness = 0.06
    put(cage, brass)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(x, y, 0.6)); put(bpy.context.object, core_m)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.6, depth=0.1, location=(x, y, 0.06)); put(bpy.context.object, brass)

# Balls: 24, glass / steel / brass, settled on a loose grid with jitter
R = 0.36
ball_mats = [glass, steel, brass]
balls = []
cols, rows = 8, 4
for r_ in range(rows):
    for c_ in range(cols):
        x = -5.6 + c_ * 1.6 + random.uniform(-0.35, 0.35)
        y = 3.4 - r_ * 2.2 + random.uniform(-0.35, 0.35)
        if (Vector((x, y)) - CORE.xy).length < 2.4:
            continue
        balls.append(Vector((x, y, R + 0.02)))
balls = balls[:24]
for i, p in enumerate(balls):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R, location=p, segments=48, ring_count=24); b = bpy.context.object
    put(b, ball_mats[(i * 7) % 3]); bpy.ops.object.shade_smooth()
    # small resonance glow under each ball
    bpy.ops.mesh.primitive_circle_add(radius=R * 1.25, fill_type='NGON', location=(p.x, p.y, 0.025)); g = bpy.context.object
    put(g, disc_m)
    bpy.ops.object.text_add(location=(p.x, p.y, p.z + R + 0.005)); t = bpy.context.object
    t.data.body = f'{i + 1:02d}'; t.data.size = 0.34; t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
    t.data.extrude = 0.005; put(t, ink)

# Resonance web: low arcs between neighbours and into the core
def link(a, b, thick=0.022, lift=0.25):
    c = bpy.data.curves.new('link', 'CURVE'); c.dimensions = '3D'; c.bevel_depth = thick; c.resolution_u = 16
    s = c.splines.new('BEZIER'); s.bezier_points.add(1)
    a2, b2 = Vector((a.x, a.y, 0.08)), Vector((b.x, b.y, 0.08))
    mid = (a2 + b2) / 2 + Vector((0, 0, lift))
    for pt, co in zip(s.bezier_points, (a2, b2)):
        pt.co = co; pt.handle_left = pt.handle_right = mid
        pt.handle_left_type = pt.handle_right_type = 'FREE'
    o = bpy.data.objects.new('link', c); scene.collection.objects.link(o); c.materials.append(link_m)
done = set()
for i, a in enumerate(balls):
    for j in sorted(range(len(balls)), key=lambda k: (balls[k] - a).length)[1:4]:
        key = (min(i, j), max(i, j))
        if key not in done and (balls[j] - a).length < 2.9:
            done.add(key); link(a, balls[j])
for i in sorted(range(len(balls)), key=lambda k: (balls[k].xy - CORE.xy).length)[:6]:
    link(balls[i], CORE + Vector((0, 0, 0.3)), 0.03, 0.6)
# swirl rings on the floor: the field changing phase
for rad, w in [(2.6, 0.025), (4.0, 0.018), (5.6, 0.012)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=rad, minor_radius=w, location=CORE + Vector((0, 0, 0.05)))
    tr = bpy.context.object; tr.scale.y = 0.72; put(tr, link_m)

# Lights: warm desk lamp key, cool core fill
bpy.ops.object.light_add(type='AREA', location=(-9, 6, 9)); key = bpy.context.object
key.data.energy = 2600; key.data.size = 4; key.data.color = (1.0, 0.72, 0.42)
key.rotation_euler = (Vector((0, 0, 0)) - key.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.light_add(type='POINT', location=CORE + Vector((0, 0, 1.0))); core = bpy.context.object
core.data.energy = 900; core.data.color = CYAN; core.data.shadow_soft_size = 0.4
bpy.ops.object.light_add(type='AREA', location=(8, -10, 6)); rim = bpy.context.object
rim.data.energy = 500; rim.data.size = 8; rim.data.color = (1.0, 0.85, 0.65)
rim.rotation_euler = (Vector((0, 0, 0)) - rim.location).to_track_quat('-Z', 'Y').to_euler()

# Camera
if SHOT == 'wide':
    loc, target, lens, fstop = Vector((0, -15.5, 13.5)), Vector((0, 0.4, 0)), 38, 4.0
else:  # hero: low and close, across the web toward the core
    loc, target, lens, fstop = Vector((4.8, -9.2, 2.6)), CORE + Vector((-0.6, 0, 0.6)), 32, 2.2
bpy.ops.object.camera_add(location=loc); cam = bpy.context.object; scene.camera = cam
cam.data.lens = lens
cam.rotation_euler = (target - loc).to_track_quat('-Z', 'Y').to_euler()
cam.data.dof.use_dof = True; cam.data.dof.focus_distance = (target - loc).length; cam.data.dof.aperture_fstop = fstop

scene.render.filepath = f'{OUT}/miniature-{SHOT}.png'
bpy.ops.render.render(write_still=True)
print('WROTE', scene.render.filepath)
