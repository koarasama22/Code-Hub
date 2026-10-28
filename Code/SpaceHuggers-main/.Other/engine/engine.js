'use strict';

const engineName = 'LittleJS';
const engineVersion = 'v0.74';
const FPS = 60, timeDelta = 1/FPS;
const defaultFont = 'arial'; 
const maxWidth = 1920, maxHeight = 1200; 
const fixedWidth = 0; 

const defaultTileSize = vec2(16); 
const tileBleedShrinkFix = .3;    
const pixelated = 1;              

const gravity = -.01;
let mainCanvas=0, mainContext=0, mainCanvasSize=vec2();
let engineObjects=[], engineCollideObjects=[];
let frame=0, time=0, realTime=0, paused=0, frameTimeLastMS=0, frameTimeBufferMS=0, debugFPS=0;
let cameraPos=vec2(), cameraScale=4*max(defaultTileSize.x, defaultTileSize.y);
let tileImageSize, tileImageSizeInverse, shrinkTilesX, shrinkTilesY, drawCount;

const tileImage = new Image(); 
function engineInit(appInit, appUpdate, appUpdatePost, appRender, appRenderPost)
{
    
    tileImage.onload = ()=>
    {
        
        tileImageSizeInverse = vec2(1).divide(tileImageSize = vec2(tileImage.width, tileImage.height));
        debug && (tileImage.onload=()=>ASSERT(1)); 
        shrinkTilesX = tileBleedShrinkFix/tileImageSize.x;
        shrinkTilesY = tileBleedShrinkFix/tileImageSize.y;

        
        document.body.appendChild(mainCanvas = document.createElement('canvas'));
        document.body.style = 'margin:0;overflow:hidden;background:#000';
        mainCanvas.style = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);image-rendering:crisp-edges;image-rendering:pixelated';          
        mainContext = mainCanvas.getContext('2d');

        debugInit();
        glInit();
        appInit();
        engineUpdate();
    };

    
    const engineUpdate = (frameTimeMS=0)=>
    {
        requestAnimationFrame(engineUpdate);
        
        if (!document.hasFocus())
            inputData[0].length = 0; 

        
        const realFrameTimeDeltaMS = frameTimeMS - frameTimeLastMS;
        let frameTimeDeltaMS = realFrameTimeDeltaMS;
        frameTimeLastMS = frameTimeMS;
        realTime = frameTimeMS / 1e3;
        if (debug)
            frameTimeDeltaMS *= keyIsDown(107) ? 5 : keyIsDown(109) ? .2 : 1;
        if (!paused)
            frameTimeBufferMS += frameTimeDeltaMS;

        
        mousePosWorld = screenToWorld(mousePosScreen);
        updateGamepads();

        
        let deltaSmooth = 0;
        if (frameTimeBufferMS < 0 && frameTimeBufferMS > -9)
        {
            
            deltaSmooth = frameTimeBufferMS;
            frameTimeBufferMS = 0;
            
        }
        

        
        frameTimeBufferMS = min(frameTimeBufferMS, 50);
        
        
        for (;frameTimeBufferMS >= 0; frameTimeBufferMS -= 1e3 / FPS)
        {
            
            appUpdate();
            engineUpdateObjects();
            appUpdatePost();
            debugUpdate();

            
            for(let deviceInputData of inputData)
                deviceInputData.map(k=> k.r = k.p = 0);
            mouseWheel = 0;
        }

        
        frameTimeBufferMS += deltaSmooth;

        if (fixedWidth)
        {
            
            mainCanvas.width = fixedWidth;
            mainCanvas.height = fixedHeight;
            
            
            const fixedAspect = fixedWidth / fixedHeight;
            const aspect = innerWidth / innerHeight;
            mainCanvas.style.width = aspect < fixedAspect ? '100%' : '';
            mainCanvas.style.height = aspect < fixedAspect ? '' : '100%';
        }
        else
        {
            
            mainCanvas.width = min(innerWidth, maxWidth);
            mainCanvas.height = min(innerHeight, maxHeight);
        }

        
        mainCanvasSize = vec2(mainCanvas.width, mainCanvas.height);
        mainContext.imageSmoothingEnabled = !pixelated; 

        
        glPreRender(mainCanvas.width, mainCanvas.height);
        appRender();
        engineObjects.sort((a,b)=> a.renderOrder - b.renderOrder);
        for(const o of engineObjects)
            o.destroyed || o.render();
        glCopyToContext(mainContext);
        appRenderPost();
        debugRender();

        if (showWatermark)
        {
            
            debugFPS = lerp(.05, 1e3/(realFrameTimeDeltaMS||1), debugFPS);
            mainContext.textAlign = 'right';
            mainContext.textBaseline = 'top';
            mainContext.font = '1em monospace';
            mainContext.fillStyle = '#000';
            const text = engineName + ' ' + engineVersion + ' / ' 
                + drawCount + ' / ' + engineObjects.length + ' / ' + debugFPS.toFixed(1);
            mainContext.fillText(text, mainCanvas.width-3, 3);
            mainContext.fillStyle = '#fff';
            mainContext.fillText(text, mainCanvas.width-2,2);
            drawCount = 0;
        }

        
        glCopyToContext(mainContext);
    }

    
    tileImage.src = 
`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABABAMAAAAg+GJMAAAAJ1BMVEUAAAD///+AgID/AAAAAACJT6T/dwBIG11mlD2i91azs7PZ2dlAQEA9UPniAAAAAXRSTlMAQObYZgAAAoRJREFUeNqsk8dZw0AQhWfNiHDbARfgVAB0sNI3LTgcfSLcbasC0o0j6panHIYMT+FX+p8y/UdECJnNJlTn6PJnft4wEvHFasCkis2JakItl9dpemjZxgniywInnhX2hWAxXug0NIwKcduwjRTpF8hVLp7PJDSEuE5X24ofFZAQV7cAEZtDQ4jLJcSKgzuAXD8DDuVDdGOFmWjNaPN0v1zdPtU0BTSIi8cQY60ZPWcQ715r2oIzeqFupBQbZqVY0xY8PT1RN6zIh7QP8TTL+lcwmiE1megkRagif1DgvB8WsAILbQpYgZ2aD8kWsGLMUSybdfMpm1tgDRiJzfr7P5MteGufDpXchoE4jGcKj32C2oBKsM5jlPUlT4VKyN9TdFuSwKsfqrLHTcE5ucQgKL8H+GZW2n0YZptZKUXSXhIUic4nfa4OXrPPNmXTxI8BwzCBFcP6DjGxfwFmmwIwBv548/sccBJqPGRK10uYu5YCtRkD/r3xc8AEELDOk6ZAn3OHXR7h19D8OAckE3ukFiAkyb7V+lPXAqecd/8DYCSAkAGK+r37W3fhDZYCQqg4ICS/HKjNQsACbuYYRHLmHLh1BFfRHikKevd0dwATAQzTW3Dv7n8DKCrsZSF51wLh2hssfCOGQTLoegvZrn/j0iIlVEyKLSDjk0VaWGVjZERCQpHLqwywcEzIlbCChLArx1SbpQBgjITB5+f88l6bw+tLnbzW2eZWJQGEOMwKk3hz4JQnuy8FIH4tw+T2QNkNzSmeA0eA7T0BgFMc8mQox9qsCiQIY+AwDO/bNSOk4zaMIxxyvi8AMAW2xwcH1o+w/hHXf+P6RVq/yo86pjXn/PT09LTsL3dlHSBbTLmdAAAAAElFTkSuQmCC`;
}

function engineUpdateObjects()
{
    
    const updateObject = (o)=>
    {
        if (!o.destroyed)
        {
            o.update();
            for(const child of o.children)
                updateObject(child);
        }
    }
    for(const o of engineObjects)
        o.parent || updateObject(o);
    engineObjects = engineObjects.filter(o=>!o.destroyed);
    engineCollideObjects = engineCollideObjects.filter(o=>!o.destroyed);
    time = ++frame / FPS;
}

function forEachObject(pos, size=0, callbackFunction=(o)=>1, collideObjectsOnly=1)
{
    const objectList = collideObjectsOnly ? engineCollideObjects : engineObjects;
    if (!size)
    {
        
        for (const o of objectList)
            callbackFunction(o);
    }
    else if (size.x != undefined)
    {
        
        for (const o of objectList)
            isOverlapping(pos, size, o.pos, o.size) && callbackFunction(o);
    }
    else
    {
        
        const sizeSquared = size**2;
        for (const o of objectList)
            pos.distanceSquared(o.pos) < sizeSquared && callbackFunction(o);
    }
}
