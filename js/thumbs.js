// Small scenes drawn live in the homepage's reading panel, one per case or project that has something to
// show moving: drawn for the panel's own shape, at once, at any screen's sharpness, and weighing nothing.
// THUMBS[href] = function(){ return function draw(ctx, w, h, t, col){...} }: the outer call makes a scene with
// its own state; draw paints frame t (seconds) on a w x h canvas, col being the section's colour.
(function(){
  var TAU=Math.PI*2;
  function lerp(a,b,x){return a+(b-a)*x;}
  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  function alpha(hex,a){var n=parseInt(hex.slice(1),16);return 'rgba('+(n>>16)+','+(n>>8&255)+','+(n&255)+','+a+')';}
  var CARS=['#3c4a5c','#8a2f2f','#d8d4cb','#4f5a43','#2b2d30','#b7a68a'];

  // counting every vehicle: a road seen by a camera, vehicles in their boxes, a counting band across it, and
  // each lane's count going up as a vehicle crosses the band
  function count(){
    var LANES=3,LOOP=1.25,PB=.62,cars=[];
    for(var l=0;l<LANES;l++)for(var k=0;k<3;k++)cars.push({l:l,v:.16+l*.03+k*.01,ph:k*.43+l*.21,c:CARS[(l*3+k)%CARS.length],tr:(l+k)%4===0});
    return function(c,w,h,t,col){
      c.fillStyle='#dfe0d6';c.fillRect(0,0,w,h);
      var top=-h*.05,bot=h,yAt=function(p){return lerp(top,bot,Math.pow(p,1.5));},hw=function(p){return lerp(w*.09,w*.62,p);};
      // the road
      c.fillStyle='#c4c3bb';c.beginPath();c.moveTo(w/2-hw(0),yAt(0));c.lineTo(w/2+hw(0),yAt(0));c.lineTo(w/2+hw(1),bot);c.lineTo(w/2-hw(1),bot);c.fill();
      // lane marks, flowing towards the camera
      c.strokeStyle='#f4f3ee';for(var m=1;m<LANES;m++){var f=m/LANES*2-1;
        for(var d=0;d<14;d++){var p0=((d/14+t*.12)%1),p1=p0+.035;if(p1>1)continue;c.lineWidth=lerp(.6,2.4,p0);
          c.beginPath();c.moveTo(w/2+f*hw(p0),yAt(p0));c.lineTo(w/2+f*hw(p1),yAt(p1));c.stroke();}}
      c.lineWidth=1.5;[-1,1].forEach(function(f){c.beginPath();c.moveTo(w/2+f*hw(0),yAt(0));c.lineTo(w/2+f*hw(1),bot);c.stroke();});
      // the counting band, each lane's part lit for a moment when a vehicle crosses it
      var flash=[0,0,0],cnt=[41,57,23];
      cars.forEach(function(o){var s=t*o.v+o.ph,n=Math.floor((s+LOOP-PB)/LOOP);cnt[o.l]+=n;var since=((s-PB)%LOOP+LOOP)%LOOP;if(since<.05&&s>=PB)flash[o.l]=Math.max(flash[o.l],1-since/.05);});
      var b0=PB-.015,b1=PB+.015;
      for(var l=0;l<LANES;l++){var fa=l/LANES*2-1,fb=(l+1)/LANES*2-1;
        c.fillStyle=alpha(col,.25+.6*flash[l]);c.beginPath();c.moveTo(w/2+fa*hw(b0),yAt(b0));c.lineTo(w/2+fb*hw(b0),yAt(b0));c.lineTo(w/2+fb*hw(b1),yAt(b1));c.lineTo(w/2+fa*hw(b1),yAt(b1));c.fill();}
      // the vehicles, far ones first, each in its box
      cars.map(function(o){return {o:o,p:((t*o.v+o.ph)%LOOP)/LOOP*1.08-.04};}).sort(function(a,b){return a.p-b.p;}).forEach(function(q){
        var p=q.p,o=q.o;if(p<0||p>1.04)return;var fx=(o.l+.5)/LANES*2-1,x=w/2+fx*hw(p),y=yAt(p),s=lerp(.12,1,p);
        var cw=(o.tr?52:40)*s,ch=(o.tr?62:44)*s;
        c.fillStyle='rgba(0,0,0,.12)';rr(c,x-cw/2+2*s,y-ch+3*s,cw,ch,5*s);c.fill();
        c.fillStyle=o.c;rr(c,x-cw/2,y-ch,cw,ch,5*s);c.fill();
        c.fillStyle='rgba(255,255,255,.35)';rr(c,x-cw*.36,y-ch*.86,cw*.72,ch*.3,3*s);c.fill();
        c.strokeStyle=col;c.lineWidth=Math.max(1,1.6*s);c.strokeRect(x-cw/2-4*s,y-ch-4*s,cw+8*s,ch+8*s);});
      // the counts, one per lane
      c.font='600 11px "IBM Plex Mono",monospace';c.textBaseline='top';
      for(l=0;l<LANES;l++){var tx=8+l*58,lit=flash[l]>0;c.fillStyle=lit?col:'rgba(244,243,238,.88)';rr(c,tx,8,52,18,3);c.fill();
        c.fillStyle=lit?'#f4f3ee':'#1a1c1b';c.fillText('L'+(l+1)+' '+cnt[l],tx+6,11);}
    };
  }

  // presence at a traffic light: a junction from above, vehicles queuing at the red light, and each lane's zone
  // before the stop line telling the light whether someone is waiting there
  function presence(){
    var LANES=2,CYC=9,RED=5.5,q=[[],[]],cross=[],last=null,spawn=[.3,1.1],cspawn=0;
    return function(c,w,h,t,col){
      var dt=last===null?0:Math.min(.1,t-last);last=t;var tc=t%CYC,red=tc<RED;
      var lw=Math.min(34,w*.11),rx=w*.42,stop=h*.36,cy0=h*.08,cy1=stop-6;
      c.fillStyle='#d9dbd0';c.fillRect(0,0,w,h);
      c.fillStyle='#c4c3bb';c.fillRect(rx-lw*LANES-4,0,lw*LANES*2+8,h);c.fillRect(0,cy0,w,cy1-cy0);
      // marks: the lanes, the centre line, the stop line
      c.strokeStyle='#f4f3ee';c.lineWidth=1.5;c.setLineDash([8,8]);
      c.beginPath();c.moveTo(rx-lw,stop);c.lineTo(rx-lw,h);c.moveTo(0,(cy0+cy1)/2);c.lineTo(rx-lw*LANES-4,(cy0+cy1)/2);c.moveTo(rx+lw*LANES+4,(cy0+cy1)/2);c.lineTo(w,(cy0+cy1)/2);c.stroke();c.setLineDash([]);
      c.lineWidth=2;c.beginPath();c.moveTo(rx,0);c.lineTo(rx,cy0);c.moveTo(rx,stop);c.lineTo(rx,h);c.stroke();
      c.lineWidth=3;c.beginPath();c.moveTo(rx-lw*LANES,stop);c.lineTo(rx,stop);c.stroke();
      // the vehicles coming up each lane: they stop at the line on red, behind the one ahead, and go on green
      var cl=lw*.62,len=lw*1.15,gap=7;
      for(var l=0;l<LANES;l++){spawn[l]-=dt;var Q=q[l];
        if(spawn[l]<=0&&(!Q.length||Q[Q.length-1].y<h-len-gap)){Q.push({y:h+len,v:52,c:CARS[(Math.random()*CARS.length)|0]});spawn[l]=1.4+Math.random()*1.6;}
        for(var i=0;i<Q.length;i++){var o=Q[i],lim=-1e9;
          if(red&&o.y>stop-2)lim=stop+4;if(i>0)lim=Math.max(lim,Q[i-1].y+len+gap);
          var ny=o.y-o.v*dt;o.y=Math.max(ny,lim);}
        q[l]=Q.filter(function(o){return o.y>-len;});}
      // the cross street moves while this one waits
      cspawn-=dt;if(!red?false:cspawn<=0){cross.push({x:-50,d:1,c:CARS[(Math.random()*CARS.length)|0]});cross.push({x:w+50,d:-1,c:CARS[(Math.random()*CARS.length)|0]});cspawn=1.8+Math.random();}
      cross.forEach(function(o){o.x+=o.d*70*dt;});cross=cross.filter(function(o){return o.x>-60&&o.x<w+60;});
      cross.forEach(function(o){var y=o.d>0?(cy0+cy1)/2+4:cy0+4;c.fillStyle=o.c;rr(c,o.x-len/2,y,len,cl*.85,3);c.fill();});
      // each lane's zone before the stop line, lit while a vehicle stands in it
      var zh=len*1.9;
      for(l=0;l<LANES;l++){var x0=rx-lw*(LANES-l),on=q[l].some(function(o){return o.y<stop+zh&&o.y+len>stop;});
        c.fillStyle=alpha(col,on?.34:.08);c.fillRect(x0+3,stop+3,lw-6,zh);c.strokeStyle=alpha(col,on?1:.5);c.lineWidth=on?2:1;c.strokeRect(x0+3,stop+3,lw-6,zh);
        q[l].forEach(function(o){c.fillStyle='rgba(0,0,0,.12)';rr(c,x0+(lw-cl)/2+1.5,o.y+2,cl,len,4);c.fill();c.fillStyle=o.c;rr(c,x0+(lw-cl)/2,o.y,cl,len,4);c.fill();
          c.fillStyle='rgba(255,255,255,.35)';rr(c,x0+(lw-cl)/2+3,o.y+4,cl-6,len*.22,2);c.fill();});
        // what the zone tells the light, beside it: the left lane's on the left, the right lane's on the right
        c.font='600 10px "IBM Plex Mono",monospace';c.textBaseline='middle';c.textAlign=l?'left':'right';
        c.fillStyle=on?col:'rgba(26,28,27,.45)';c.fillText(on?'present':'empty',l?rx+lw*LANES+10:x0-8,stop+zh/2);}
      c.textAlign='left';
      // the light
      var lx=rx+lw*.55,ly=stop+zh+18;c.fillStyle='#1a1c1b';rr(c,lx-7,ly-16,14,32,4);c.fill();
      c.fillStyle=red?'#e0533d':'#3a2420';c.beginPath();c.arc(lx,ly-8,4.5,0,TAU);c.fill();
      c.fillStyle=red?'#20302a':'#46c07a';c.beginPath();c.arc(lx,ly+8,4.5,0,TAU);c.fill();
    };
  }

  // ombres: a paper-cut landscape at dusk, a lantern's glow, and a shadow bird crossing the chasm
  function ombres(){
    return function(c,w,h,t){
      var g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#f1e3c4');g.addColorStop(1,'#d7b98a');c.fillStyle=g;c.fillRect(0,0,w,h);
      var lx=w*.78,ly=h*.3,fl=1+.04*Math.sin(t*7)+.03*Math.sin(t*11.3);
      var rg=c.createRadialGradient(lx,ly,2,lx,ly,h*.9*fl);rg.addColorStop(0,'rgba(255,236,190,.95)');rg.addColorStop(.25,'rgba(255,214,150,.35)');rg.addColorStop(1,'rgba(255,214,150,0)');c.fillStyle=rg;c.fillRect(0,0,w,h);
      // hills, back to front, a cut through the nearest one
      [['#b99a72',.55,.07,.9],['#8f7152',.68,.09,1.7],['#4a3a2c',.8,.0,0]].forEach(function(L,i){c.fillStyle=L[0];c.beginPath();c.moveTo(0,h);
        for(var x=0;x<=w;x+=6){var y=h*L[1]+Math.sin(x/w*TAU*L[3]+i)*h*L[2];if(i===2&&x>w*.36&&x<w*.58)y=h+4;c.lineTo(x,y);}c.lineTo(w,h);c.fill();});
      // the lantern on its post
      c.strokeStyle='#2b2119';c.lineWidth=2;c.beginPath();c.moveTo(lx,h*.8);c.lineTo(lx,ly+8);c.stroke();
      c.fillStyle='#ffe7b0';rr(c,lx-5,ly-7,10,14,3);c.fill();c.strokeStyle='#2b2119';c.lineWidth=1.2;c.stroke();
      // the bird: flies across, wings beating, over the gap
      var P=7,u=(t%P)/P,bx=lerp(-30,w+30,u),by=h*.5-Math.sin(u*Math.PI)*h*.22+Math.sin(t*3)*3,fl2=Math.sin(t*9);
      c.fillStyle='#1d1712';c.beginPath();c.ellipse(bx,by,11,4.5,0,0,TAU);c.fill();
      c.beginPath();c.moveTo(bx+9,by-2);c.lineTo(bx+16,by);c.lineTo(bx+9,by+1.5);c.fill();
      c.beginPath();c.moveTo(bx-10,by);c.lineTo(bx-17,by-4);c.lineTo(bx-16,by+3);c.fill();
      c.beginPath();c.moveTo(bx-4,by-1);c.quadraticCurveTo(bx-2,by-16*fl2,bx+5,by-22*fl2);c.quadraticCurveTo(bx+4,by-8*fl2,bx+5,by-1);c.fill();
      // the player's hand, a soft shadow at the edge, making the shape
      c.fillStyle='rgba(29,23,18,.16)';c.beginPath();c.ellipse(w*.12,h*.98,w*.13,h*.32,-.3+Math.sin(t*1.3)*.05,0,TAU);c.fill();
    };
  }

  // streetscore: people crossing a dim street pluck invisible strings, each one ringing in its own colour
  function streetscore(){
    var NOTES=['C','D','E','G','A'],HUES=['#e9b44c','#e0533d','#5bb3d9','#8fd06b','#c88be0'],walk=[],hit=[0,0,0,0,0],init=false;
    return function(c,w,h,t){
      if(!init){init=true;for(var i=0;i<6;i++){var a=Math.random()*TAU;walk.push({x:Math.random()*w,y:Math.random()*h,vx:Math.cos(a)*(14+Math.random()*16),vy:Math.sin(a)*(10+Math.random()*12),tr:[],car:i%5===0});}}
      var dt=1/60;c.fillStyle='#17191c';c.fillRect(0,0,w,h);
      // the crossing's stripes, barely there
      c.fillStyle='rgba(255,255,255,.05)';for(var s=0;s<12;s++)c.fillRect(s*w/12+4,h*.2,w/24,h*.6);
      var S=NOTES.map(function(n,k){return {a:{x:0,y:h*(.14+k*.18)},b:{x:w,y:h*(.24+k*.15)-h*.1}};});
      walk.forEach(function(o){var px=o.x,py=o.y;o.x+=o.vx*dt*(o.car?2:1);o.y+=o.vy*dt*(o.car?2:1);
        if(o.x<-10)o.x=w+10;if(o.x>w+10)o.x=-10;if(o.y<-10)o.y=h+10;if(o.y>h+10)o.y=-10;
        S.forEach(function(L,k){var side=function(x,y){return (L.b.x-L.a.x)*(y-L.a.y)-(L.b.y-L.a.y)*(x-L.a.x);};if(Math.abs(o.x-px)<20&&side(px,py)*side(o.x,o.y)<0)hit[k]=1;});
        o.tr.push([o.x,o.y]);if(o.tr.length>26||Math.abs(o.x-px)>20)o.tr=o.tr.slice(-1);});
      // the strings, vibrating as they ring and fading back
      S.forEach(function(L,k){var amp=hit[k]*5;hit[k]*=.94;c.strokeStyle=hit[k]>.05?HUES[k]:'rgba(255,255,255,.12)';c.lineWidth=1+hit[k]*1.5;
        c.shadowColor=HUES[k];c.shadowBlur=hit[k]*12;c.beginPath();
        for(var x=0;x<=w;x+=4){var u=x/w,y=lerp(L.a.y,L.b.y,u)+Math.sin(u*Math.PI)*Math.sin(t*40+k)*amp;x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();c.shadowBlur=0;
        c.fillStyle=hit[k]>.05?HUES[k]:'rgba(255,255,255,.35)';c.font='600 10px "IBM Plex Mono",monospace';c.fillText(NOTES[k],4,L.a.y-4);});
      // the walkers and vehicles, their trails glowing, each in its box
      walk.forEach(function(o){c.strokeStyle='rgba(233,180,76,.5)';c.lineWidth=1.5;c.beginPath();o.tr.forEach(function(p,i){i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);});c.stroke();
        var bw=o.car?18:7,bh=o.car?11:15;c.fillStyle=o.car?'#c9ccd1':'#f4f3ee';c.beginPath();c.arc(o.x,o.y,o.car?4:2.6,0,TAU);c.fill();
        c.strokeStyle='rgba(120,220,140,.85)';c.lineWidth=1;c.strokeRect(o.x-bw/2,o.y-bh/2,bw,bh);});
    };
  }

  // working with AI agents: a run's working memory fills from the three shelves, acts through its tools, then
  // empties, and what happened is written back
  function harness(){
    var KIND=['#a352e0','#5295e0','#d9a93f'],NAME=['how','know','happened'];
    return function(c,w,h,t,col){
      c.fillStyle='#efeee8';c.fillRect(0,0,w,h);var P=9,u=t%P;
      var sx=12,sw=w*.27,mx=w*.4,mw=w*.33,my=h*.18,mh=h*.64,tx=w*.8;
      c.font='500 10px "IBM Plex Mono",monospace';c.textBaseline='middle';
      // the vault's three shelves
      NAME.forEach(function(n,k){var y=h*(.2+k*.3);c.fillStyle=alpha(KIND[k],.14);rr(c,sx,y-12,sw,24,4);c.fill();c.strokeStyle=KIND[k];c.lineWidth=1.2;c.stroke();c.fillStyle=KIND[k];c.fillText(n,sx+8,y);});
      // the working memory
      var empty=u>7.4;c.strokeStyle=col;c.lineWidth=1.6;c.setLineDash(empty?[4,4]:[]);rr(c,mx,my,mw,mh,6);c.stroke();c.setLineDash([]);
      c.fillStyle=col;c.fillText('working memory',mx+6,my-8);
      // chips coming in, one after the other
      var IN=[[0,.6],[2,1.4],[1,2.2],[0,3]];
      IN.forEach(function(q,i){var k=q[0],a=Math.max(0,Math.min(1,(u-q[1])/.6));if(u<q[1]||empty)return;var fy=h*(.2+k*.3),ty=my+14+i*15,e=a<.5?2*a*a:1-Math.pow(-2*a+2,2)/2;
        var x=lerp(sx+sw-30,mx+8,e),y=lerp(fy,ty,e);c.fillStyle=KIND[k];rr(c,x,y-5,mw-16,10,3);c.globalAlpha=.85;c.fill();c.globalAlpha=1;});
      // the tools: a pulse goes out and comes back, a few times
      c.fillStyle='#1a1c1b';['edit','build','test'].forEach(function(n,k){var y=h*(.28+k*.22);c.strokeStyle='rgba(26,28,27,.4)';c.lineWidth=1;rr(c,tx-4,y-9,w-tx-4,18,4);c.stroke();c.fillText(n,tx+3,y);
        var s=4+k*.9;if(u>s&&u<s+.9){var a=(u-s)/.9,x=a<.5?lerp(mx+mw,tx-4,a*2):lerp(tx-4,mx+mw,(a-.5)*2);c.fillStyle=col;c.beginPath();c.arc(x,y,3.5,0,TAU);c.fill();c.fillStyle='#1a1c1b';}});
      // at the end: emptied, and a note goes back to "happened"
      if(u>7.4){var a=Math.min(1,(u-7.4)/1);c.fillStyle=KIND[2];var x=lerp(mx+8,sx+sw-30,a),y=lerp(my+mh/2,h*.8,a);rr(c,x,y-5,30,10,3);c.fill();}
    };
  }

  window.THUMBS={
    '/work/traffic-statistics/':count,'/lab/traffic-statistics/':count,
    '/work/presence-at-traffic-lights/':presence,'/lab/presence-at-traffic-lights/':presence,
    'https://youyou0.github.io/ombres/':ombres,'https://github.com/youyou0/streetscore':streetscore,
    '/work/working-with-ai-agents/':harness
  };
})();
