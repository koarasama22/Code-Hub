'use strict';

const glEnable = 1;     
let glCanvas, glContext, glTileTexture, glShader, glPositionData, glColorData, 
    glBatchCount, glDirty, glAdditive, glShrinkTilesX, glShrinkTilesY, glOverlay;

function glInit()
{
    if (!glEnable) return;

    
    glCanvas = document.createElement('canvas');
    glContext = glCanvas.getContext('webgl', {antialias:!pixelated});
    glTileTexture = glCreateTexture(tileImage);
    glShrinkTilesX = tileBleedShrinkFix/tileImageSize.x;
    glShrinkTilesY = tileBleedShrinkFix/tileImageSize.y;

    if (glOverlay)
    {
        
        document.body.appendChild(glCanvas);
        glCanvas.style = mainCanvas.style.cssText;
    }

    
    glShader = glCreateProgram(
        'precision lowp float;'+    
        'uniform mat4 m;'+          
        'attribute float a;'+       
        'attribute vec2 p,s,t;'+    
        'attribute vec4 c,b;'+      
        'varying vec2 v;'+          
        'varying vec4 d,e;'+        
        'void main(){'+             
        'gl_Position=m*vec4((s*cos(-a)+vec2(-s.y,s.x)*sin(-a))*.5+p,1,1);'+
        'v=t;d=c;e=b;'+             
        '}'                         
        ,
        'precision lowp float;'+             
        'varying vec2 v;'+                   
        'varying vec4 d,e;'+                 
        'uniform sampler2D j;'+              
        'void main(){'+                      
        'gl_FragColor=texture2D(j,v)*d+e;'+  
        '}'                                  
    );

    
    const glVertexData = new ArrayBuffer(MAX_BATCH * VERTICES_PER_QUAD * VERTEX_STRIDE);
    glCreateBuffer(gl_ARRAY_BUFFER, glVertexData.byteLength, gl_DYNAMIC_DRAW);
    glPositionData = new Float32Array(glVertexData);
    glColorData = new Uint32Array(glVertexData);

    
    const initVertexAttribArray = (name, type, typeSize, size, normalize=0)=>
    {
        const location = glContext.getAttribLocation(glShader, name);
        glContext.enableVertexAttribArray(location);
        glContext.vertexAttribPointer(location, size, type, normalize, VERTEX_STRIDE, offset);
        offset += size*typeSize;
    }
    let offset = glDirty = glBatchCount = 0;
    initVertexAttribArray('a', gl_FLOAT, 4, 1);            
    initVertexAttribArray('p', gl_FLOAT, 4, 2);            
    initVertexAttribArray('s', gl_FLOAT, 4, 2);            
    initVertexAttribArray('t', gl_FLOAT, 4, 2);            
    initVertexAttribArray('c', gl_UNSIGNED_BYTE, 1, 4, 1); 
    initVertexAttribArray('b', gl_UNSIGNED_BYTE, 1, 4, 1); 

    
    glContext.texParameteri(gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, pixelated ? gl_NEAREST : gl_LINEAR);
    glContext.texParameteri(gl_TEXTURE_2D, gl_TEXTURE_MAG_FILTER, pixelated ? gl_NEAREST : gl_LINEAR);
}

function glSetBlendMode(additive)
{
    if (!glEnable) return;
        
    if (additive != glAdditive)
        glFlush();

    
    glAdditive = additive;

    glContext.blendFunc(gl_SRC_ALPHA, additive ? gl_ONE : gl_ONE_MINUS_SRC_ALPHA)
    

    glContext.enable(gl_BLEND);
}

function glCompileShader(source, type)
{
    if (!glEnable) return;

    
    const shader = glContext.createShader(type);
    glContext.shaderSource(shader, source);
    glContext.compileShader(shader);

    
    if (debug && !glContext.getShaderParameter(shader, gl_COMPILE_STATUS))
        throw glContext.getShaderInfoLog(shader);
    return shader;
}

function glCreateProgram(vsSource, fsSource)
{
    if (!glEnable) return;

    
    const program = glContext.createProgram();
    glContext.attachShader(program, glCompileShader(vsSource, gl_VERTEX_SHADER));
    glContext.attachShader(program, glCompileShader(fsSource, gl_FRAGMENT_SHADER));
    glContext.linkProgram(program);

    
    if (debug && !glContext.getProgramParameter(program, gl_LINK_STATUS))
        throw glContext.getProgramInfoLog(program);
    return program;
}

function glCreateBuffer(bufferType, size, usage)
{
    if (!glEnable) return;

    
    const buffer = glContext.createBuffer();
    glContext.bindBuffer(bufferType, buffer);
    glContext.bufferData(bufferType, size, usage);
    return buffer;
}

function glCreateTexture(image)
{
    if (!glEnable) return;

    
    const texture = glContext.createTexture();
    glContext.bindTexture(gl_TEXTURE_2D, texture);
    glContext.texImage2D(gl_TEXTURE_2D, 0, gl_RGBA, gl_RGBA, gl_UNSIGNED_BYTE, image);
    return texture;
}

function glPreRender(width, height)
{
    if (!glEnable) return;

    
    glCanvas.width = width;
    glCanvas.height = height;
    glContext.viewport(0, 0, width, height);

    
    glContext.useProgram(glShader);
    glSetBlendMode();

    
    const sx = 2 * cameraScale / width;
    const sy = 2 * cameraScale / height;
    glContext.uniformMatrix4fv(glContext.getUniformLocation(glShader, 'm'), 0,
        new Float32Array([
            sx, 0, 0, 0,
            0, sy, 0, 0,
            1, 1, -1, 1,
            -1-sx*cameraPos.x, -1-sy*cameraPos.y, 0, 0
        ])
    );
}

function glFlush()
{
    if (!glEnable) return;
    if (!glBatchCount)
        return;

    
    glContext.bufferSubData(gl_ARRAY_BUFFER, 0, glPositionData.subarray(0, glBatchCount * VERTICES_PER_QUAD * VERTEX_STRIDE));
    glContext.drawArrays(gl_TRIANGLES, 0, glBatchCount * VERTICES_PER_QUAD);
    glBatchCount = 0;
}

function glCopyToContext(context, forceDraw)
{
    if (!glEnable) return;
    if (!glDirty)  return;
    
    
    glFlush();

    if (!glOverlay || forceDraw)
    {
        
        context.drawImage(glCanvas, 0, glAdditive = glDirty = 0);
        glContext.clear(gl_COLOR_BUFFER_BIT);
    }
}

function glDraw(x, y, sizeX, sizeY, angle, mirror, uv0X, uv0Y, uv1X, uv1Y, abgr, abgrAdditive)
{
    if (!glEnable) return;
    
    
    if (glBatchCount >= MAX_BATCH)
        glFlush();

    if (tileBleedShrinkFix)
    {
        
        uv0X += glShrinkTilesX;
        uv0Y += glShrinkTilesY;
        uv1X -= glShrinkTilesX;
        uv1Y -= glShrinkTilesY;
    }
    
    
    let offset = glBatchCount++ * VERTICES_PER_QUAD * INDICIES_PER_VERT - 1;
    sizeX = mirror ? -sizeX : sizeX;
    glDirty = 1;

    
    glPositionData[++offset] = angle;
    glPositionData[++offset] = x;
    glPositionData[++offset] = y;
    glPositionData[++offset] = -sizeX;
    glPositionData[++offset] = -sizeY;
    glPositionData[++offset] = uv0X;
    glPositionData[++offset] = uv1Y;
    glColorData[++offset] = abgr;
    glColorData[++offset] = abgrAdditive;
    
    
    glPositionData[++offset] = angle;
    glPositionData[++offset] = x;
    glPositionData[++offset] = y;
    glPositionData[++offset] = sizeX;
    glPositionData[++offset] = sizeY;
    glPositionData[++offset] = uv1X;
    glPositionData[++offset] = uv0Y;
    glColorData[++offset] = abgr;
    glColorData[++offset] = abgrAdditive;
    
    
    glPositionData[++offset] = angle;
    glPositionData[++offset] = x;
    glPositionData[++offset] = y;
    glPositionData[++offset] = -sizeX;
    glPositionData[++offset] = sizeY;
    glPositionData[++offset] = uv0X;
    glPositionData[++offset] = uv0Y;
    glColorData[++offset] = abgr;
    glColorData[++offset] = abgrAdditive;
    
    
    glPositionData[++offset] = angle;
    glPositionData[++offset] = x;
    glPositionData[++offset] = y;
    glPositionData[++offset] = -sizeX;
    glPositionData[++offset] = -sizeY;
    glPositionData[++offset] = uv0X;
    glPositionData[++offset] = uv1Y;
    glColorData[++offset] = abgr;
    glColorData[++offset] = abgrAdditive;

    
    glPositionData[++offset] = angle;
    glPositionData[++offset] = x;
    glPositionData[++offset] = y;
    glPositionData[++offset] = sizeX;
    glPositionData[++offset] = -sizeY;
    glPositionData[++offset] = uv1X;
    glPositionData[++offset] = uv1Y;
    glColorData[++offset] = abgr;
    glColorData[++offset] = abgrAdditive;

    
    glPositionData[++offset] = angle;
    glPositionData[++offset] = x;
    glPositionData[++offset] = y;
    glPositionData[++offset] = sizeX;
    glPositionData[++offset] = sizeY;
    glPositionData[++offset] = uv1X;
    glPositionData[++offset] = uv0Y;
    glColorData[++offset] = abgr;
    glColorData[++offset] = abgrAdditive;
}

const 
gl_ONE = 1,
gl_TRIANGLES = 4,
gl_SRC_ALPHA = 770,
gl_ONE_MINUS_SRC_ALPHA = 771,
gl_BLEND = 3042,
gl_TEXTURE_2D = 3553,
gl_UNSIGNED_BYTE = 5121,
gl_FLOAT = 5126,
gl_RGBA = 6408,
gl_NEAREST = 9728,
gl_LINEAR = 9729,
gl_TEXTURE_MAG_FILTER = 10240,
gl_TEXTURE_MIN_FILTER = 10241,
gl_COLOR_BUFFER_BIT = 16384,
gl_ARRAY_BUFFER = 34962,
gl_DYNAMIC_DRAW = 35048,
gl_FRAGMENT_SHADER = 35632, 
gl_VERTEX_SHADER = 35633,
gl_COMPILE_STATUS = 35713,
gl_LINK_STATUS = 35714,

VERTICES_PER_QUAD = 6,
INDICIES_PER_VERT = 9,
MAX_BATCH = 1<<16,
VERTEX_STRIDE = 4 + (4 * 2) * 3 + (4) * 2;
