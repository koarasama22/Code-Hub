'use strict';

let tileCollision = [];
let tileCollisionSize = vec2();
const tileLayerCanvasCache = [];
const defaultTileLayerRenderOrder = -1e9;
const debugRaycast = 0;

function initTileCollision(size)
{
    
    tileCollisionSize = size;
    tileCollision = [];
    for(let i=tileCollision.length = tileCollisionSize.area(); i--;)
        tileCollision[i] = 0;
}

const setTileCollisionData = (pos, data=0)=>
    pos.arrayCheck(tileCollisionSize) && (tileCollision[(pos.y|0)*tileCollisionSize.x+pos.x|0] = data);
const getTileCollisionData = (pos)=>
    pos.arrayCheck(tileCollisionSize) ? tileCollision[(pos.y|0)*tileCollisionSize.x+pos.x|0] : 0;

function tileCollisionTest(pos, size=vec2(), object)
{
    
    const minX = pos.x - size.x*.5|0;
    const minY = pos.y - size.y*.5|0;
    const maxX = pos.x + size.x*.5|0;
    const maxY = pos.y + size.y*.5|0;
    for(let y = minY; y <= maxY; ++y)
    for(let x = minX; x <= maxX; ++x)
    {
        const tileData = tileCollision[y*tileCollisionSize.x + x];
        if (tileData && (!object || object.collideWithTile(tileData, new Vector2(x, y))))
            return 1;
    }
}

function tileCollisionRaycast(posStart, posEnd, object)
{
    
    posStart = posStart.int();
    posEnd = posEnd.int();
    const posDelta = posEnd.subtract(posStart);
    const dx = abs(posDelta.x),  dy = -abs(posDelta.y);
    const sx = sign(posDelta.x), sy = sign(posDelta.y);
    let e = dx + dy;

    for(let x = posStart.x, y = posStart.y;;)
    {
        const tileData = getTileCollisionData(vec2(x,y));
        if (tileData && (object ? object.collideWithTileRaycast(tileData, new Vector2(x, y)) : tileData > 0))
        {
            debugRaycast && debugLine(posStart, posEnd, '#f00',.02, 1);
            debugRaycast && debugPoint(new Vector2(x+.5, y+.5), '#ff0', 1);
            return new Vector2(x+.5, y+.5);
        }

        
        if (x == posEnd.x & y == posEnd.y) break;
        const e2 = 2*e;
        if (e2 >= dy) e += dy, x += sx;
        if (e2 <= dx) e += dx, y += sy;
    }
    debugRaycast && debugLine(posStart, posEnd, '#00f',.02, 1);
}

class TileLayerData
{
    constructor(tile=-1, direction=0, mirror=0, color=new Color)
    {
        this.tile      = tile;
        this.direction = direction;
        this.mirror    = mirror;
        this.color     = color;
    }
    clear() { this.tile = this.direction = this.mirror = 0; color = new Color; }
}

class TileLayer extends EngineObject
{
    constructor(pos, size, scale=vec2(1), layer=0)
    {
        super(pos, size);

        
        this.canvas = tileLayerCanvasCache.length ? tileLayerCanvasCache.pop() : document.createElement('canvas');
        this.context = this.canvas.getContext('2d');

        this.scale = scale;
        this.tileSize = defaultTileSize.copy();
        this.layer = layer;
        this.renderOrder = defaultTileLayerRenderOrder + layer;
        this.flushGLBeforeRender = 1;

        
        this.data = [];
        for(let j = this.size.area(); j--;)
            this.data.push(new TileLayerData());
    }

    destroy()
    {
        
        tileLayerCanvasCache.push(this.canvas);
        super.destroy();
    }
    
    setData(layerPos, data, redraw)
    {
        if (layerPos.arrayCheck(this.size))
        {
            this.data[(layerPos.y|0)*this.size.x+layerPos.x|0] = data;
            redraw && this.drawTileData(layerPos);
        }
    }
    
    getData(layerPos)
    { return layerPos.arrayCheck(this.size) && this.data[(layerPos.y|0)*this.size.x+layerPos.x|0]; }
    
    update() {} 
    render()
    {
        ASSERT(mainContext != this.context); 

        
        this.flushGLBeforeRender && glEnable && glCopyToContext(mainContext);
        
        
        const pos = worldToScreen(this.pos.add(vec2(0,this.size.y*this.scale.y)));
        mainContext.drawImage
        (
            this.canvas, pos.x, pos.y,
            cameraScale*this.size.x*this.scale.x, cameraScale*this.size.y*this.scale.y
        );
    }

    redraw()
    {
        
        this.redrawStart();
        this.drawAllTileData();
        this.redrawEnd();
    }

    redrawStart(clear = 1)
    {
        
        const width = this.size.x * this.tileSize.x;
        const height = this.size.y * this.tileSize.y;

        if (clear)
        {
            this.canvas.width  = width;
            this.canvas.height = height;
        }

        
        this.savedRenderSettings = [mainCanvasSize, mainCanvas, mainContext, cameraScale, cameraPos];

        
        cameraScale = this.tileSize.x;
        cameraPos = this.size.scale(.5);
        mainCanvas = this.canvas;
        mainContext = this.context;
        mainContext.imageSmoothingEnabled = !pixelated; 
        mainCanvasSize = vec2(width, height);
        glPreRender(width, height);
    }

    redrawEnd()
    {
        ASSERT(mainContext == this.context); 
        glCopyToContext(mainContext, 1);
        

        
        [mainCanvasSize, mainCanvas, mainContext, cameraScale, cameraPos] = this.savedRenderSettings;
    }

    drawTileData(layerPos)
    {
        
        const pos = layerPos.int().add(this.pos).add(vec2(.5));
        this.drawCanvas2D(pos, vec2(1), 0, 0, (context)=>context.clearRect(-.5, -.5, 1, 1));

        
        const d = this.getData(layerPos);
        ASSERT(d.tile < 0 || mainContext == this.context); 
        d.tile < 0 || drawTile(pos, vec2(1), d.tile || -1, this.tileSize, d.color, d.direction*PI/2, d.mirror);
    }

    drawAllTileData()
    {
        for(let x = this.size.x; x--;)
        for(let y = this.size.y; y--;)
             this.drawTileData(vec2(x,y));
    }

    
    drawCanvas2D(pos, size, angle, mirror, drawFunction)
    {
        const context = this.context;
        context.save();
        pos = pos.subtract(this.pos).multiply(this.tileSize);
        size = size.multiply(this.tileSize);
        context.translate(pos.x, this.canvas.height - pos.y);
        context.rotate(angle);
        context.scale(mirror?-size.x:size.x, size.y);
        drawFunction(context);
        context.restore();
    }

    drawTile(pos, size=vec2(1), tileIndex=0, tileSize=defaultTileSize, color=new Color, angle=0, mirror)
    {
        
        this.drawCanvas2D(pos, size, angle, mirror, (context)=>
        {
            if (tileIndex < 0)
            {
                
                context.fillStyle = color.rgba();
                context.fillRect(-.5, -.5, 1, 1);
            }
            else
            {
                const cols = tileImage.width/tileSize.x;
                context.globalAlpha = color.a; 
                context.drawImage(tileImage, 
                    (tileIndex%cols)*tileSize.x, (tileIndex/cols|0)*tileSize.x, 
                    tileSize.x, tileSize.y, -.5, -.5, 1, 1);
            }
        });
    }

    drawRect(pos, size, color, angle) { this.drawTile(pos, size, -1, 0, color, angle, 0); }
}
