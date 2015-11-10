
CLOUDS = {};
CLOUDS.Clouds = function(scene, pos, spread)
{
    pos = pos || new THREE.Vector3();
    spread = spread || 1000;
    var geometry = new THREE.Geometry();

    var sprite = THREE.ImageUtils.loadTexture( "textures/sprites/clouds.png" );

    var nparts = 200;
    var spread = 1000;
    for ( var i = 0; i < nparts; i ++ ) {
	var vertex = new THREE.Vector3();
	vertex.x = pos.x + Math.random() * spread - spread/2;
	vertex.y = pos.y + Math.random() * spread - spread/2;
	vertex.z = pos.z + Math.random() * spread - spread/2;
	geometry.vertices.push( vertex );
    }

    var ngroups = 5;
    var materials = [];
    this.group = new THREE.Object3D();
    for ( i = 0; i < ngroups; i ++ ) {
	color  = [1.0, 0.2, 0.5];
        size = 350;
	materials[i] = new THREE.PointCloudMaterial(
				 { size: size,
				   map: sprite,
				   blending: THREE.AdditiveBlending,
                                   depthTest: false,
                                   transparent : true } );
	materials[i].color.setHSL( color[0], color[1], color[2] );
	materials[i].opacity = 0.02;
	var particles = new THREE.PointCloud( geometry, materials[i] );
	particles.rotation.x = Math.random() * 6;
	particles.rotation.y = Math.random() * 6;
	particles.rotation.z = Math.random() * 6;
        this.group.add(particles);
	//scene.add( particles );
    }

    this.update = function() {
	var time = Date.now() * 0.00005;
	var children = this.group.children;
	for ( i = 0; i < children.length; i ++ ) {
	    var object = children[ i ];
	    if ( object instanceof THREE.PointCloud ) {
		//object.rotation.y = time * ( i < 4 ? i + 1 : - ( i + 1 ) );
		object.rotation.z = time * ( i < 4 ? i + 1 : - ( i + 1 ) );
	    }
	}
    }

}
