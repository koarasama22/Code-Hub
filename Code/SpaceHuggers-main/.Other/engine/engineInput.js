'use strict';

const enableGamepads = 1;
const enableTouchInput = 0;
const copyGamepadDirectionToStick = 1;
const copyWASDToDpad = 1;

const inputData = [[]];
const keyIsDown      = (key, device=0)=> inputData[device][key] && inputData[device][key].d ? 1 : 0;
const keyWasPressed  = (key, device=0)=> inputData[device][key] && inputData[device][key].p ? 1 : 0;
const keyWasReleased = (key, device=0)=> inputData[device][key] && inputData[device][key].r ? 1 : 0;
const clearInput     = ()=> inputData[0].length = 0;

let hadInput   = 0;
let mouseWheel = 0;
let mousePosScreen = vec2();
let mousePosWorld  = vec2();
const mouseIsDown      = keyIsDown;
const mouseWasPressed  = keyWasPressed;
const mouseWasReleased = keyWasReleased;

onkeydown   = e=>
{
    if (debug && e.target != document.body) return;
    e.repeat || (inputData[isUsingGamepad = 0][remapKeyCode(e.keyCode)] = {d:hadInput=1, p:1});
}
onkeyup     = e=>
{
    if (debug && e.target != document.body) return;
    const c = remapKeyCode(e.keyCode); inputData[0][c] && (inputData[0][c].d = 0, inputData[0][c].r = 1);
}
onmousedown = e=> (inputData[0][e.button] = {d:hadInput=1, p:1}, onmousemove(e));
onmouseup   = e=> inputData[0][e.button] && (inputData[0][e.button].d = 0, inputData[0][e.button].r = 1);
onmousemove = e=>
{
    if (!mainCanvas)
        return;

    
    const rect = mainCanvas.getBoundingClientRect();
    mousePosScreen.x = mainCanvasSize.x * percent(e.x, rect.right, rect.left);
    mousePosScreen.y = mainCanvasSize.y * percent(e.y, rect.bottom, rect.top);
}
if(debug)
    onwheel = e=> e.ctrlKey || (mouseWheel = sign(e.deltaY));
oncontextmenu = e=> !1; 
const remapKeyCode = c=> copyWASDToDpad ? c==87?38 : c==83?40 : c==65?37 : c==68?39 : c : c;

let isUsingGamepad = 0;
let gamepadCount = 0;
const gamepadStick       = (stick,  gamepad=0)=> gamepad < gamepadCount ? inputData[gamepad+1].stickData[stick] : vec2();
const gamepadIsDown      = (button, gamepad=0)=> gamepad < gamepadCount ? keyIsDown     (button, gamepad+1) : 0;
const gamepadWasPressed  = (button, gamepad=0)=> gamepad < gamepadCount ? keyWasPressed (button, gamepad+1) : 0;
const gamepadWasReleased = (button, gamepad=0)=> gamepad < gamepadCount ? keyWasReleased(button, gamepad+1) : 0;

function updateGamepads()
{
    if (!navigator.getGamepads || !enableGamepads)
        return;

    if (!document.hasFocus() && !debug)
        return;

    const gamepads = navigator.getGamepads();
    gamepadCount = 0;
    for(let i = 0; i < navigator.getGamepads().length; ++i)
    {
        
        const gamepad = gamepads[i];
        let data = inputData[i+1];
        if (!data)
        {
            data = inputData[i+1] = [];
            data.stickData = [vec2(), vec2()];
        }

        if (gamepad && gamepad.axes.length >= 2)
        {
            gamepadCount = i+1;

            
            const deadZone = .3, deadZoneMax = .8;
            const applyDeadZone = (v)=> 
                v >  deadZone ?  percent( v, deadZoneMax, deadZone) : 
                v < -deadZone ? -percent(-v, deadZoneMax, deadZone) : 0;
            data.stickData[0] = vec2(applyDeadZone(gamepad.axes[0]), applyDeadZone(-gamepad.axes[1]));
            
            if (copyGamepadDirectionToStick)
            {
                
                if (gamepadIsDown(12,i)|gamepadIsDown(13,i)|gamepadIsDown(14,i)|gamepadIsDown(15,i))
                    data.stickData[0] = vec2(gamepadIsDown(15,i) - gamepadIsDown(14,i), gamepadIsDown(12,i) - gamepadIsDown(13,i));
            }

            
            data.stickData[0] = data.stickData[0].clampLength();
            
            
            gamepad.buttons.map((button, j)=>
            {
                inputData[i+1][j] = button.pressed ? {d:1, p:!gamepadIsDown(j,i)} : 
                inputData[i+1][j] = {r:gamepadIsDown(j,i)}
                isUsingGamepad |= button.pressed && !i;
            });
        }
    }
}

if (enableTouchInput && window.ontouchstart !== undefined)
{
    
    ontouchstart = ontouchmove = ontouchend = e=>
    {
        e.button = 0; 
        hadInput || zzfx(hadInput = 1) ; 

        
        const touching = e.touches.length;
        if (touching)
        {
            
            e.x = e.touches[0].clientX;
            e.y = e.touches[0].clientY;
            wasTouching ? onmousemove(e) : onmousedown(e);
        }
        else if (wasTouching)
            wasTouching && onmouseup(e);

        
        wasTouching = touching;
    }
    let wasTouching;
}
