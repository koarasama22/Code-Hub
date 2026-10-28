'use strict';

const defaultObjectSize = vec2(.999);
const defaultObjectMass = 1;
const defaultObjectDamping = .99;
const defaultObjectAngleDamping = .99;
const defaultObjectElasticity = 0;
const defaultObjectFriction = .8;
const maxObjectSpeed = 1;

class EngineObject
{
    constructor(pos, size=defaultObjectSize, tileIndex=-1, tileSize=defaultTileSize, angle=0, color)
    {
        
        ASSERT(pos);
        this.pos = pos.copy();
        this.size = size;
        this.tileIndex = tileIndex;
        this.tileSize = tileSize;
        this.angle = angle;
        this.color = color;

        
        this.mass         = defaultObjectMass;
        this.damping      = defaultObjectDamping;
        this.angleDamping = defaultObjectAngleDamping;
        this.elasticity   = defaultObjectElasticity;
        this.friction     = defaultObjectFriction;

        
        this.spawnTime = time;
        this.velocity = vec2(this.collideSolidObjects = this.renderOrder = this.angleVelocity = 0);
        this.collideTiles = this.gravityScale = 1;
        this.children = [];

        
        engineObjects.push(this);
    }
    
    update()
    {
        if (this.parent)
        {
            
            this.pos = this.localPos.multiply(vec2(this.getMirrorSign(),1)).rotate(-this.parent.angle).add(this.parent.pos);
            this.angle = this.getMirrorSign()*this.localAngle + this.parent.angle;
            return;
        }

        
        this.velocity.x = clamp(this.velocity.x, maxObjectSpeed, -maxObjectSpeed);
        this.velocity.y = clamp(this.velocity.y, maxObjectSpeed, -maxObjectSpeed);

        
        const oldPos = this.pos.copy();
        this.pos.x += this.velocity.x = this.damping * this.velocity.x;
        this.pos.y += this.velocity.y = this.damping * this.velocity.y + gravity * this.gravityScale;
        this.angle += this.angleVelocity *= this.angleDamping;

        
        ASSERT(this.angleDamping >= 0 && this.angleDamping <= 1);
        ASSERT(this.damping >= 0 && this.damping <= 1);

        if (!this.mass) 
            return;

        const wasMovingDown = this.velocity.y < 0;
        if (this.groundObject)
        {
            
            const groundSpeed = this.groundObject.velocity ? this.groundObject.velocity.x : 0;
            this.velocity.x = groundSpeed + (this.velocity.x - groundSpeed) * this.friction;
            this.groundObject = 0;
            
        }

        if (this.collideSolidObjects)
        {
            
            const epsilon = 1e-3; 
            for(const o of engineCollideObjects)
            {
                
                if (!this.isSolid & !o.isSolid || o.destroyed || o.parent)
                    continue;

                
                if (!isOverlapping(this.pos, this.size, o.pos, o.size) || o == this)
                    continue;

                
                if (!this.collideWithObject(o) | !o.collideWithObject(this))
                    continue;

                if (isOverlapping(oldPos, this.size, o.pos, o.size))
                {
                    
                    const deltaPos = oldPos.subtract(o.pos);
                    const length = deltaPos.length();
                    const pushAwayAccel = .001; 
                    const velocity = length < .01 ? randVector(pushAwayAccel) : deltaPos.scale(pushAwayAccel/length);
                    this.velocity = this.velocity.add(velocity);
                    if (o.mass) 
                        o.velocity = o.velocity.subtract(velocity);
                        
                    debugPhysics && debugAABB(this.pos, o.pos, this.size, o.size, '#f00');
                    continue;
                }

                
                const sx = this.size.x + o.size.x;
                const sy = this.size.y + o.size.y;
                const smallStepUp = (oldPos.y - o.pos.y)*2 > sy + gravity; 
                const isBlockedX = abs(oldPos.y - o.pos.y)*2 < sy;
                const isBlockedY = abs(oldPos.x - o.pos.x)*2 < sx;
                
                if (smallStepUp || isBlockedY || !isBlockedX) 
                {
                    
                    this.pos.y = o.pos.y + (sy*.5 + epsilon) * sign(oldPos.y - o.pos.y);
                    if (o.groundObject && wasMovingDown || !o.mass)
                    {
                        
                        if (wasMovingDown)
                            this.groundObject = o;

                        
                        this.velocity.y *= -this.elasticity;
                    }
                    else if (o.mass)
                    {
                        
                        this.velocity.y = o.velocity.y = 
                            (this.mass * this.velocity.y + o.mass * o.velocity.y) / (this.mass + o.mass);
                    }
                    debugPhysics && smallStepUp && (abs(oldPos.x - o.pos.x)*2 > sx) && console.log('stepUp', oldPos.y - o.pos.y);
                }
                if (!smallStepUp && (isBlockedX || !isBlockedY)) 
                {
                    
                    this.pos.x = o.pos.x + (sx*.5 + epsilon) * sign(oldPos.x - o.pos.x);
                    if (o.mass)
                    {
                        
                        this.velocity.x = o.velocity.x = 
                            (this.mass * this.velocity.x + o.mass * o.velocity.x) / (this.mass + o.mass);
                    }
                    else 
                        this.velocity.x *= -this.elasticity;
                }

                debugPhysics && debugAABB(this.pos, o.pos, this.size, o.size, '#f0f');
            }
        }
        if (this.collideTiles)
        {
            
            if (tileCollisionTest(this.pos, this.size, this))
            {
                

                
                
                if (!tileCollisionTest(oldPos, this.size, this))
                {
                    
                    const isBlockedY = tileCollisionTest(new Vector2(oldPos.x, this.pos.y), this.size, this);
                    const isBlockedX = tileCollisionTest(new Vector2(this.pos.x, oldPos.y), this.size, this);
                    if (isBlockedY || !isBlockedX)
                    {
                        
                        this.groundObject = wasMovingDown;

                        
                        this.pos.y = oldPos.y;
                        this.velocity.y *= -this.elasticity;
                    }
                    if (isBlockedX || !isBlockedY)
                    {
                        
                        this.pos.x = oldPos.x;
                        this.velocity.x *= -this.elasticity;
                    }
                }
            }
        }
    }
       
    render()
    {
        
        drawTile(this.pos, this.size, this.tileIndex, this.tileSize, this.color, this.angle, this.mirror, this.additiveColor);
    }
    
    destroy()             
    { 
        if (this.destroyed)
            return;
        
        
        this.destroyed = 1;
        this.parent && this.parent.removeChild(this);
        for(const child of this.children)
            child.destroy(child.parent = 0);
    }
    collideWithTile(data, pos)        { return data > 0; }
    collideWithTileRaycast(data, pos) { return data > 0; }
    collideWithObject(o)              { return 1; }
    getAliveTime()                    { return time - this.spawnTime; }
    applyAcceleration(a)              { ASSERT(!this.isFixed()); this.velocity = this.velocity.add(a); }
    applyForce(force)	              { this.applyAcceleration(force.scale(1/this.mass)); }
    isFixed()                         { return !this.mass; }
    getMirrorSign(s=1)                { return this.mirror ? -s : s; }

    addChild(child, localPos=vec2(), localAngle=0)
    {
        ASSERT(!child.parent && !this.children.includes(child));
        this.children.push(child);
        child.parent = this;
        child.localPos = localPos.copy();
        child.localAngle = localAngle;
    }
    removeChild(child)
    {
        ASSERT(child.parent == this && this.children.includes(child));
        this.children.splice(this.children.indexOf(child), 1);
        child.parent = 0;
    }

    setCollision(collideSolidObjects=1, isSolid, collideTiles=1)
    {
        ASSERT(collideSolidObjects || !isSolid); 

        
        if (collideSolidObjects && !this.collideSolidObjects)
        {
            ASSERT(!engineCollideObjects.includes(this));
            engineCollideObjects.push(this);
        }
        else if (!collideSolidObjects && this.collideSolidObjects)
        {
            ASSERT(engineCollideObjects.includes(this))
            engineCollideObjects.splice(engineCollideObjects.indexOf(this), 1);
        }

        this.collideSolidObjects = collideSolidObjects;
        this.isSolid = isSolid;
        this.collideTiles = collideTiles;
    }
}
