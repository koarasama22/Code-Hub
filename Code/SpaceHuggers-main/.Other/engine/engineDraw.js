'use strict';

const screenToWorld = (screenPos)=>
    screenPos.add(vec2(.5)).subtract(mainCanvasSize.scale(.5)).multiply(vec2(1/cameraScale,-1/cameraScale)).add(cameraPos);
const worldToScreen = (worldPos)=>
    worldPos.subtract(cameraPos).multiply(vec2(cameraScale,-cameraScale)).add(mainCanvasSize.scale(.5)).subtract(vec2(.5));

function drawTile(pos, size=vec2(1), tileIndex=-1, tileSize=defaultTileSize, color=new Color, angle=0, mirror, 
    additiveColor=new Color(0,0,0,0))
{
    if (!size.x  | !size.y)
        return;
        
    showWatermark && ++drawCount;
    if (glEnable)
    {
        if (tileIndex < 0)
        {
            
            glDraw(pos.x, pos.y, size.x, size.y, angle, 0, 0, 0, 0, 0, 0, color.rgbaInt()); 
        }
        else
        {
            
            const cols = tileImage.width / tileSize.x |0;
            const uvSizeX = tileSize.x * tileImageSizeInverse.x;
            const uvSizeY = tileSize.y * tileImageSizeInverse.y;
            const uvX = (tileIndex%cols)*uvSizeX, uvY = (tileIndex/cols|0)*uvSizeY;
            glDraw(pos.x, pos.y, size.x, size.y, angle, mirror, 
                uvX, uvY, uvX + uvSizeX, uvY + uvSizeY, color.rgbaInt(), additiveColor.rgbaInt()); 
        }
    }
    else
    {
        
        drawCanvas2D(pos, size, angle, mirror, (context)=>
        {
            if (tileIndex < 0)
            {
                
                context.fillStyle = color.rgba();
                context.fillRect(-.5, -.5, 1, 1);
            }
            else
            {
                
                const cols = tileImage.width / tileSize.x |0;
                const sX = (tileIndex%cols)*tileSize.x   + tileBleedShrinkFix;
                const sY = (tileIndex/cols|0)*tileSize.y + tileBleedShrinkFix;
                const sWidth  = tileSize.x - 2*tileBleedShrinkFix;
                const sHeight = tileSize.y - 2*tileBleedShrinkFix;
                context.globalAlpha = color.a; 
                context.drawImage(tileImage, sX, sY, sWidth, sHeight, -.5, -.5, 1, 1);
            }
        });
    }
}

function drawRect(pos, size, color, angle)
{
    drawTile(pos, size, -1, defaultTileSize, color, angle);
}

function drawTileScreenSpace(pos, size=vec2(1), tileIndex, tileSize, color, angle, mirror, additiveColor)
{
    drawTile(screenToWorld(pos), size.scale(1/cameraScale), tileIndex, tileSize, color, angle, mirror, additiveColor);
}

function drawRectScreenSpace(pos, size, color, angle)
{
    drawTileScreenSpace(pos, size, -1, defaultTileSize, color, angle);
}

function drawLine(posA, posB, thickness=.1, color)
{
    const halfDelta = vec2((posB.x - posA.x)*.5, (posB.y - posA.y)*.5);
    const size = vec2(thickness, halfDelta.length()*2);
    drawRect(posA.add(halfDelta), size, color, halfDelta.angle());
}

function drawCanvas2D(pos, size, angle, mirror, drawFunction)
{
    
    pos = worldToScreen(pos);
    size = size.scale(cameraScale);
    mainContext.save();
    mainContext.translate(pos.x+.5|0, pos.y-.5|0);
    mainContext.rotate(angle);
    mainContext.scale(mirror?-size.x:size.x, size.y);
    drawFunction(mainContext);
    mainContext.restore();
}

function drawText(text, pos, size=1, color=new Color, lineWidth=0, lineColor=new Color(0,0,0), textAlign='center', font=defaultFont)
{
    pos = worldToScreen(pos);
    mainContext.font = size*cameraScale + 'px '+ font;
    mainContext.textAlign = textAlign;
    mainContext.textBaseline = 'middle';
    if (lineWidth)
    {
        mainContext.lineWidth = lineWidth*cameraScale;
        mainContext.strokeStyle = lineColor.rgba();
        mainContext.strokeText(text, pos.x, pos.y);
    }
    mainContext.fillStyle = color.rgba();
    mainContext.fillText(text, pos.x, pos.y);
}

function setBlendMode(additive)
{
    glEnable ? glSetBlendMode(additive) : mainContext.globalCompositeOperation = additive ? 'lighter' : 'source-over';
}
