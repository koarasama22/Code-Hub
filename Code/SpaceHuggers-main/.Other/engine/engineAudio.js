'use strict';

const soundEnable = 1;       
const defaultSoundRange = 15;
const soundTaperPecent = .5; 
const audioVolume = .5;        
let audioContext;            

function playSound(zzfxSound, pos, range=defaultSoundRange, volumeScale=1)
{
    if (!soundEnable) return;

    const lengthSquared = cameraPos.distanceSquared(pos);
    const maxRange = range * (soundTaperPecent + 1);
    if (lengthSquared > maxRange**2)
        return;

    
    zzfxSound = [...zzfxSound];

    
    const scale = volumeScale * percent(lengthSquared**.5, range, maxRange);
    zzfxSound[0] = (zzfxSound[0]||1) * scale;
    zzfx(...zzfxSound);
}

function playMusic(zzfxmMusic, loop=1) 
{
    if (!soundEnable) return;

    const source = zzfxP(...zzfxM(...zzfxmMusic));
    source && (source.loop = loop);
    return source;
}

function speak(text, language='', volume=1, rate=1, pitch=1)
{
    if (!soundEnable || !speechSynthesis) return;

    
    
    

    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.volume = volume*audioVolume*3;
    utterance.rate = rate;
    utterance.pitch = pitch;
    speechSynthesis.speak(utterance);
}

const stopSpeech = ()=> speechSynthesis && speechSynthesis.cancel();

const zzfxR = 44100; 
function zzfx(
    
    volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0,
    release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0,
    pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0,
    bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0
)
{
    
    if (!soundEnable || !hadInput) return;

    
    let PI2 = PI*2, sign = v => v>0?1:-1,
        startSlide = slide *= 500 * PI2 / zzfxR / zzfxR, b=[],
        startFrequency = frequency *= (1 + randomness*2*Math.random() - randomness) * PI2 / zzfxR,
        t=0, tm=0, i=0, j=1, r=0, c=0, s=0, f, length;
        
    
    attack = attack * zzfxR + 9; 
    decay *= zzfxR;
    sustain *= zzfxR;
    release *= zzfxR;
    delay *= zzfxR;
    deltaSlide *= 500 * PI2 / zzfxR**3;
    modulation *= PI2 / zzfxR;
    pitchJump *= PI2 / zzfxR;
    pitchJumpTime *= zzfxR;
    repeatTime = repeatTime * zzfxR | 0;

    
    for(length = attack + decay + sustain + release + delay | 0;
        i < length; b[i++] = s)
    {
        if (!(++c%(bitCrush*100|0)))                      
        {
            s = shape? shape>1? shape>2? shape>3?         
                Math.sin((t%PI2)**3) :                    
                Math.max(Math.min(Math.tan(t),1),-1):     
                1-(2*t/PI2%2+2)%2:                        
                1-4*abs(Math.round(t/PI2)-t/PI2):    
                Math.sin(t);                              
                
            s = (repeatTime ?
                    1 - tremolo + tremolo*Math.sin(PI2*i/repeatTime) 
                    : 1) *
                sign(s)*(abs(s)**shapeCurve) *       
                volume * audioVolume * (                  
                i < attack ? i/attack :                   
                i < attack + decay ?                      
                1-((i-attack)/decay)*(1-sustainVolume) :  
                i < attack  + decay + sustain ?           
                sustainVolume :                           
                i < length - delay ?                      
                (length - i - delay)/release *            
                sustainVolume :                           
                0);                                       
 
            s = delay ? s/2 + (delay > i ? 0 :            
                (i<length-delay? 1 : (length-i)/delay) *  
                b[i-delay|0]/2) : s;                      
        }

        f = (frequency += slide += deltaSlide) *          
            Math.cos(modulation*tm++);                    
        t += f - f*noise*(1 - (Math.sin(i)+1)*1e9%2);     

        if (j && ++j > pitchJumpTime)       
        {
            frequency += pitchJump;         
            startFrequency += pitchJump;    
            j = 0;                          
        }

        if (repeatTime && !(++r % repeatTime)) 
        {
            frequency = startFrequency;     
            slide = startSlide;             
            j = j || 1;                     
        }
    }
    
    
    if (!audioContext)
        audioContext = new (window.AudioContext||webkitAudioContext);

    
    const buffer = audioContext.createBuffer(1, b.length, zzfxR), 
        source = audioContext.createBufferSource();

    
    buffer.getChannelData(0).set(b);
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
    return source;
}

function zzfxM(instruments, patterns, sequence, BPM = 125) 
{
    if (!soundEnable) return;
    let instrumentParameters;
    let i;
    let j;
    let k;
    let note;
    let sample;
    let patternChannel;
    let notFirstBeat;
    let stop;
    let instrument;
    let pitch;
    let attenuation;
    let outSampleOffset;
    let isSequenceEnd;
    let sampleOffset = 0;
    let nextSampleOffset;
    let sampleBuffer = [];
    let leftChannelBuffer = [];
    let rightChannelBuffer = [];
    let channelIndex = 0;
    let panning = 0;
    let hasMore = 1;
    let sampleCache = {};
    let beatLength = zzfxR / BPM * 60 >> 2;

    
    for(; hasMore; channelIndex++) {

        
        sampleBuffer = [hasMore = notFirstBeat = pitch = outSampleOffset = 0];

        
        sequence.map((patternIndex, sequenceIndex) => {
            
            patternChannel = patterns[patternIndex][channelIndex] || [0, 0, 0];

            
            hasMore |= !!patterns[patternIndex][channelIndex];

            
            nextSampleOffset = outSampleOffset + (patterns[patternIndex][0].length - 2 - !notFirstBeat) * beatLength;
            
            isSequenceEnd = sequenceIndex == sequence.length - 1;
            for (i = 2, k = outSampleOffset; i < patternChannel.length + isSequenceEnd; notFirstBeat = ++i) {

                
                note = patternChannel[i];

                
                stop = i == patternChannel.length + isSequenceEnd - 1 && isSequenceEnd ||
                        instrument != (patternChannel[0] || 0) | note | 0;

                
                for (j = 0; j < beatLength && notFirstBeat;

                        
                        j++ > beatLength - 99 && stop ? attenuation += (attenuation < 1) / 99 : 0
                ) {
                    
                    sample = (1 - attenuation) * sampleBuffer[sampleOffset++] / 2 || 0;
                    leftChannelBuffer[k] = (leftChannelBuffer[k] || 0) - sample * panning + sample;
                    rightChannelBuffer[k] = (rightChannelBuffer[k++] || 0) + sample * panning + sample;
                }

                
                if (note) {
                    
                    attenuation = note % 1;
                    panning = patternChannel[1] || 0;
                    if (note |= 0) {
                        
                        sampleBuffer = sampleCache[
                            [
                                instrument = patternChannel[sampleOffset = 0] || 0,
                                note
                            ]
                        ] = sampleCache[[instrument, note]] || (
                                
                                instrumentParameters = [...instruments[instrument]],
                                instrumentParameters[2] *= 2 ** ((note - 12) / 12),

                                
                                note > 0 ? zzfxG(...instrumentParameters) : []
                        );
                    }
                }
            }

            
            outSampleOffset = nextSampleOffset;
        });
    }

    return [leftChannelBuffer, rightChannelBuffer];
}
