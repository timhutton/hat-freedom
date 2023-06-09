/*
    hat-freedom - Exploring the degrees of freedom in the new aperiodic monotile, 'the hat'.
    Copyright (C) 2023  Tim Hutton

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

function degToRad(d) { return d * Math.PI / 180.0; }

function generateVectors(gen) {
    // given the 12 o'clock position and face normal of two clocks, generate the 12 vectors we will use to make the tiles
    const v = new Array(12);
    for( let i = 0; i < 12; i++ ) {
        let twelve = gen[i % 2];
        let normal = gen[(i % 2) + 2];
        let rad = -degToRad(30 * i);
        v[i] = twelve.clone();
        v[i].applyAxisAngle(normal, rad);
    }
    return v;
}

function generateBoundaryVertices(v, preamble, amble) {
    // generate [ x, y, z, x, y, z, ... ] for the boundary of a tile in a certain position
    const points = [];
    const point = new THREE.Vector3(0,0,0);
    // walk to the starting point
    for( let i = 0; i < preamble.length; i++ ) {
        point.add( v[preamble[i]] );
    }
    // walk around the boundary of the shape
    points.push( point.x, point.y, point.z );
    for( let i = 0; i < amble.length - 1; i++ ) { // the figure is a loop, so we skip the last step
        point.add( v[amble[i]] );
        points.push( point.x, point.y, point.z );
    }
    return points;
}

function generateInteriorTriangles(v) {
    // convert list of boundary points to triplets for the interior triangles
    if(v.length != 14 * 3)
        throw 'invalid length in array passed to generateInteriorTriangles'
    // a hard-coded crease pattern assuming v is indexed anti-clockwise from the peak of the hat
    const tris = [ 1,0,13, 2,1,3, 3,1,13, 4,3,5, 5,3,6, 6,3,7, 7,3,8, 8,3,13, 12,8,13, 9,8,12, 11,9,12, 10,9,11];
    const tri_verts = [];
    for( let i = 0; i < tris.length; i++) {
        const j = tris[i];
        tri_verts.push( v[ j * 3 ], v[ j * 3 + 1 ], v[ j * 3 + 2 ] );
    }
    return tri_verts;
}

function newOrientation(hat_def, r, flip=false) {
    // rotate the clock faces by r, with optional flipping around 12
    let new_def = [];
    for( let i = 0; i < hat_def.length; i++ ) {
        let p = hat_def[i];
        if(flip) {
            p = (12 - p) % 12;
        }
        p = (12 + p + r) % 12; // rotate
        new_def.push( p );
    }
    return new_def;
}

function check_is_closed(hat_def, v) {
    // check that the path around the hat is closed
    const p = new THREE.Vector3(0,0,0);
    for( let i = 0; i < hat_def.length; i++ ) {
        p.add( v[hat_def[i]] );
    }
    if(p.length() > 1e-5) {
        console.log(p, v);
        throw "error: hat is not closed";
    }
}

function check_flip12_is_mirror(hat_def, v) {
    // check that the flipped version of the tile (obtained by using vectors mirrored across v12) is a mirror image
    const flipped_hat_def = newOrientation(hat_def, 0, true);
    const p1 = new THREE.Vector3(0,0,0);
    const p2 = new THREE.Vector3(0,0,0);
    for( let i = 0; i < hat_def.length; i++ ) {
        p1.add( v[hat_def[i]] );
        p2.add( v[flipped_hat_def[i]] );
        const error = new THREE.Vector3(p1.x + p2.x, p1.y - p2.y, p1.z - p2.z); // expect to be flipped in x
        if(error.length() > 1e-5) {
            console.log(hat_def, flipped_hat_def);
            console.log(i, p1, p2, error);
            throw "error: flipped hat is not mirror";
        }
    }
}

function addHats(scene, gen, nonplanar) {
    // generate the 12 vectors we will use to make the tiles
    const v = generateVectors(gen); // indexed as 0=12 through 11

    // define the hat by an anti-clockwise path around the boundary starting from the peak, each entry is an index into v
    const hat_def = [7, 9, 6, 8, 5, 3, 3, 1, 4, 2, 11, 9, 0, 10];
    check_is_closed(hat_def, v);
    if( !nonplanar ) {
        check_flip12_is_mirror(hat_def, v);
    }

    // a hard-coded patch of tiles, defined as the path from the origin to the peak, then the path around the tile
    const hats = [
        [ [], hat_def ],
        [ [4, 2, 11, 9, 0, 10], hat_def ],
        [ [4, 2, 11, 9, 0, 10, 4, 2, 11, 9, 0, 10], hat_def ],
        [ [4, 2, 11, 9, 0, 10, 7, 9], newOrientation(hat_def, 2) ],
        [ [4, 6], newOrientation(hat_def, -4) ],
        [ [7, 9].concat(newOrientation([11, 9, 0, 10], -2)), newOrientation(hat_def, -2) ],
        [ [7, 9, 6, 8, 5, 3], newOrientation(hat_def, -2, true) ],
        [ [4, 2, 11, 9, 0, 10, 4, 2, 11, 9, 0, 10].concat(newOrientation([3, 1, 4, 2, 11, 9, 0, 10], -2, true)), newOrientation(hat_def, -2, true) ],
    ];
    const added_items = [];
    for( let i = 0; i < hats.length; i++ ) {
        let preamble, amble;
        [preamble, amble] = hats[i];
        const boundary_points = generateBoundaryVertices( v, preamble, amble );
        let color = new THREE.Color();
        color.setHSL(i / hats.length, 0.4, 0.7);
        const hat_tri_material = new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide });
        if( nonplanar ) {
            // add non-planar polygon using a fixed set of triangles
            const tri_points = generateInteriorTriangles( boundary_points );
            const hat_tri_geometry = new THREE.BufferGeometry();
            hat_tri_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( tri_points, 3 ) );
            hat_tri_geometry.computeVertexNormals();
            const hat_tri = new THREE.Mesh( hat_tri_geometry, hat_tri_material );
            scene.add( hat_tri );
            added_items.push( hat_tri );
        }
        else {
            // add planar polygon using Shape since a fixed set of triangles is not always appropriate
            const shape = new THREE.Shape();
            shape.moveTo(boundary_points[0], boundary_points[1]);
            for(let i = 1; i < boundary_points.length / 3; i++)
                shape.lineTo(boundary_points[i*3], boundary_points[i*3+1]);
            shape.lineTo(boundary_points[0], boundary_points[1]);
            const hat_tri_geometry = new THREE.ShapeGeometry( shape );
            const hat_tri = new THREE.Mesh( hat_tri_geometry, hat_tri_material );
            scene.add( hat_tri );
            added_items.push( hat_tri );
        }
    }
    return added_items;
}

window.onload = function() {
    // set up a scene
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth * 0.8, window.innerHeight * 0.8 );
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    document.body.appendChild( renderer.domElement );

    // add some lights
    {
        const color = 0xFFFFFF;
        const intensity = 0.6;
        const light = new THREE.PointLight(color, intensity);
        light.position.set(50, 20, -100);
        scene.add(light);
    }
    {
        const color = 0xFFFFFF;
        const intensity = 0.6;
        const light = new THREE.PointLight(color, intensity);
        light.position.set(50, 20, 100);
        scene.add(light);
    }
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // initial generating vectors
    const gen = [
        new THREE.Vector3( 0, Math.sqrt(3), 0 ), // "12 o'clock" on the red clock face
        new THREE.Vector3( 0, 1, 0 ),            // "12 o'clock" on the blue clock face
        new THREE.Vector3( 0, 0, 1 ),            // normal of red clock face
        new THREE.Vector3( 0, 0, 1 ),            // normal of blue clock face
    ];
    const nonplanar = true;
    theta = -1.0;
    if( nonplanar ) {
        gen[3].applyAxisAngle(gen[1], theta); // rotate one clock face a little to make the tiles non-planar
    }

    // generate hats from these vectors and add them to the scene
    added_items = addHats(scene, gen, nonplanar);

    const y = 2;
    camera.position.set(0, y, 15);
    camera.up.set(0, 1, 0);
    orbit_controls = new THREE.OrbitControls( camera, renderer.domElement );
    camera.lookAt( 0, y, 0 );
    orbit_controls.target.set( 0, y, 0 );

    renderer.domElement.addEventListener( 'mousemove', render, false );
    renderer.domElement.addEventListener( 'touchmove', render, false );
    renderer.domElement.addEventListener( 'mousedown',  render, false );
    renderer.domElement.addEventListener( 'touchstart',  render, false );
    renderer.domElement.addEventListener( 'mouseup',  render, false );
    renderer.domElement.addEventListener( 'mouseout',  render, false );
    renderer.domElement.addEventListener( 'touchend',  render, false );
    renderer.domElement.addEventListener( 'touchcancel',  render, false );
    renderer.domElement.addEventListener( 'wheel',  render, false );

    running = true;

    dtheta = 0.03;
    sleep_per_step = 100;

    function render() {
        renderer.render( scene, camera );
    }

    function animate() {
        if(running) {
            // remove old hats
            for(let i = 0; i < added_items.length; i++)
                scene.remove(added_items[i]);

            // change the generating vectors
            gen[3].applyAxisAngle(gen[1], dtheta); // rotate one clock face a little more
            if( Math.abs(theta) > 1.0 )
                dtheta *= -1.0;
            theta += dtheta;

            // regenerate new hats
            added_items = addHats(scene, gen, nonplanar);

            render();

            setTimeout(() => { requestAnimationFrame(animate); }, sleep_per_step);
        }
    }

    function toggle_running() {
        running = !running;
        if(running)
            animate();
    }

    render();
    animate();
}
