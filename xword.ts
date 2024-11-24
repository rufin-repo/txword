
const K={
  DefaultPtVal:10,

  DIR_Down: 1,
  DIR_Across: 0,

  // !!!!!! DANGER the following enumeration must match the "brk" encoding in Clue::constructor()
  BD_AWordStr:  1,
  BD_AAftHyphen:2,
  BD_DWordStr:  4,  // start of a new down word
  BD_DAftHyphen:8,  // start of a new word-part after a hyphen

  GC_Hilite:    1,
  GC_Caret:     2,
  GC_Revealed:  4,

  OP_RevealAll:   1,
  OP_KeepEntries: 2,
  OP_EnterKeyChk: 4,
  OP_RevealBtn:   8,
  OP_Solitary:    16,

  KBP_Top:        0,
  KBP_Bot:        1,

  CL_ActiveClue: "activeClue",
  CK_VKeyBrdPos: "vkeybdpos",
  CK_GameSave:   "XWGame",

  ClockTick:  200,
  HTTPTimeout:   15000,
};


//-----------------------------------------------------------------------
//  Some utility functions
//-----------------------------------------------------------------------
function byId(id:string) : HTMLElement { return document.getElementById(id) as HTMLElement; }
function HasClassQ(ele:HTMLElement, cls:string) : boolean {
  return ele.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'))!==null;
}
function AddClass(ele:HTMLElement, cls:string) {
  if (!HasClassQ(ele,cls)) {
    ele.className = (ele.className+" "+cls).trim();
  }
}
function RemoveClass(ele:HTMLElement, cls:string) {
  if (HasClassQ(ele,cls))
    ele.className=ele.className.replace(
      new RegExp('(\\s|^)'+cls+'(\\s|$)'),' ').trim();
}
function SetCookie(cname:string, cvalue:string)
{
  try {
    if (cvalue===null)
      window.localStorage.removeItem(cname);
    else
      window.localStorage.setItem(cname, cvalue);
  }
  catch (err) { }
} // SetCookie() //

function GetCookie(cname:string)
{
  let cvalue='';
  try {
    cvalue = window.localStorage.getItem(cname) as string;
    if (cvalue === null) cvalue='';
  }
  catch (err) { }
  return cvalue;
} // GetCookie() //


//==============================================================
//    _____    _    _______    ____
//   / ___/___(_)__/ / ___/__ / / /
//  / (_ / __/ / _  / /__/ -_) / /
//  \___/_/ /_/\_,_/\___/\__/_/_/
//
//=============================================================
class GridCell {
  mClues: Clue[];
  mEntry: string;       // what has been enter by the user
  mAnswer:string;       // the correct letter.
  mStyle:number;        // a combination of GC_.. flags
  mCorrectQ: boolean;   // true means cell has an entry verified to be correct (i.e. mEntry===mAnswer).
  mX: number;
  mY: number;
  mLabel:number;
  mWdBoundary:number;   //0: normal or a combination of BD_...

  get style() {return this.mStyle;}
  get label() {return this.mLabel;}
  get wdBoundary() {return this.mWdBoundary;}
  get entry() {return this.mEntry;}
  get answer() {return this.mAnswer;}
  get checkedQ() {return this.mCorrectQ;}
  get x() {return this.mX;}
  get y() {return this.mY;}
  get clues() {return this.mClues;}
  get unusedQ() {return this.mClues.length===0;}

  constructor(x:number=-1, y:number=-1) {
    this.mClues=[];
    this.mEntry='';
    this.mAnswer='';
    this.mCorrectQ=false;
    this.mX=x;
    this.mY=y;
    this.mWdBoundary=0;
    this.mLabel=0;  // don't set it to -1!  0 means empty.
    this.mStyle=0;
  } // constructor()

  check() : boolean {
    if (this.mAnswer && this.mEntry===this.mAnswer)
      this.mCorrectQ=true;
    else {
      // if (!(this.mCheckedQ = (this.mAnswer && this.mEntry===this.mAnswer)))
      this.mCorrectQ=false;
      this.mEntry='';  // clear the incorrect entry.
    }
    return this.mCorrectQ;
  } // check()

  setEntry(c:string) {
    this.mEntry=c;
    if (!this.mAnswer || (this.mAnswer && c!==this.mAnswer)) {
      this.mCorrectQ=false;
    }
  } // setEntry()

  addClue(c:Clue, ans:string, brk:number) {
    if (this.mClues.indexOf(c)===-1) this.mClues.push(c);
    this.mAnswer=ans;
    this.mWdBoundary|=brk;
  } // addClue()

  setLabel(label:number) {
    this.mLabel=label;
  } // setLabel()

  setStyle(sty:number) {
    this.mStyle=sty;
  } // setStyle()

  inClueQ(clue:Clue|null) {
    return clue && this.mClues.indexOf(clue)>=0;
  } // inClueQ();
} // class GridCell

interface cluelists {
  aclues: Clue[],
  dclues: Clue[]
}



//============================================================
//     ________
//    / ____/ /_  _____
//   / /   / / / / / _ \
//  / /___/ / /_/ /  __/
//  \____/_/\__,_/\___/
//
//============================================================
class Clue
{
  // Per-class static data.
  static GridW=0;
  static GridH=0;
  static Cells:GridCell[][]=[];
  static Clues:Clue[]=[];
  // static Reset() {Clue.GridW=0; Clue.GridH=0; Clue.Clues=[]; Clue.Cells=[];}

  // Per instance data members.
  mLabel:number;              // 1-based label for displaying.
  mDownQ:boolean;
  mSx:number;                 // Starting grid-cell x-coord (column index)
  mSy:number;                 // Starting grid-cell y-coord (row index)
  mWord:string;               // The answer to the clue.
  mClue:string;               // The raw clue description (without the letter count or label.)
  mLetterCountStr:string;     // The letter-count string (e.g. "(8)", "(3,2)" or "(2-3,5)") behind the clue description.
  private mBrks:number[];     // non-zero for a new start of a sub-word.
  mClaimedBy:number;          // a team/player number. -1 if unclaimed. Should only be set if all grid-cells touched by clue are checked.
  mClueEle:HTMLElement|null;  // Should be a div element.
  mPtValue:number;            // How much points does this clue worth.

  get word() :string {return this.mWord;}
  get sX() {return this.mSx;}
  get sY() {return this.mSy;}
  get downQ() {return this.mDownQ;}
  get label() {return this.mLabel;}
  get endX() {return this.mSx + (this.mDownQ ? 0 : this.mWord.length-1);}
  get endY() {return this.mSy + (this.mDownQ ? this.mWord.length-1 : 0);}
  get claimedBy() {return this.mClaimedBy;}
  get clueEle() {return this.mClueEle;}
  get ptValue() {return this.mPtValue;}

  constructor(x:number, y:number, ans:string, clue:string, downQ:boolean, ptValue:number=K.DefaultPtVal)
  {
    this.mClue=clue;
    this.mDownQ=downQ;
    this.mSx=x;
    this.mSy=y;
    this.mLabel=-1; // invalidate it first.
    this.mClaimedBy=-1; // invalidate it first.
    this.mClueEle=null;
    this.mPtValue=Math.max(ptValue,K.DefaultPtVal);

    let letterCnt='('; // letter-count string under construction.

    // Scan the word string to identify the hypen positions and word breaks.
    let wd=ans[0].toUpperCase();
    this.mBrks=[0];
    if (!wd.match(/[A-Z]/)) throw("Bad word starting with a '"+wd+"'");
    let wdlen=1;  // len of the current word or word-part
    for (let i=1; i<ans.length; i++) {
      const ci = ans.charCodeAt(i);
      if (ci!==0x2D && (ci<=0x40 || (ci>0x40+26 && ci<=0x60) || ci>0x60+26)) {
        throw("illegal character '"+ans.charAt(i)+"' in '"+ans+"'");
      }
      // Check if the character ci would trigger a word break
      const brk = (ci>0x40 && ci<=0x40+26) ? 1 : (ci===0x2D) ? 2 : 0 // A capital letter marks the start of a new word, '-'(0x2D) marsk the start of a new word part.
      if (brk) {
        letterCnt+=wdlen.toString();
        if (brk===1) letterCnt+=',';
        else {
          letterCnt+='-';
          i++;
          if (ans.charCodeAt(i)===0x2D) // another '-'??
            throw("Bad word with double hypens.");
          else if (i>=ans.length)
            throw("Bad word with a terminal hypen.");
        }
        wdlen=0;
      } // if (brk) .. //
      wdlen++;
      wd+=ans.charAt(i).toUpperCase();
      this.mBrks.push(downQ ? brk*4 : brk);
    } // for (i)
    letterCnt+=wdlen.toString()+")";
    this.mLetterCountStr = letterCnt;
    this.mWord = ans = wd;

    if (this.mBrks.length!==wd.length) throw "logical error.";

    // window.console.log(ans+":"+this.mClue+" "+ltrCnt);

    if (!ans || ans.length>15) throw("Bad word.");

    // Go through all previous clues to see if any of the letter cells for the target word clashed with them.
    const dx = /*this.mIncx =*/ downQ ? 0 : 1;
    const dy = /*this.mIncy =*/ downQ ? 1 : 0;
    for (let l=0; l<ans.length; l++) {
      const ch = ans.charAt(l);
      for (let c=0; c<Clue.Clues.length; c++) {
        const cx=this.mSx+dx*l;
        const cy=this.mSy+dy*l;
        const cc = Clue.Clues[c].charAt(cx, cy);
        if (cc && cc!==ch) {
          window.console.log("'"+ans+"' and '"+Clue.Clues[c].word+"' clashed at ("+cx+","+cy+")");
        }
      } // for (c)
    } // for (l)
    Clue.Clues.push(this);
  } // constructor() //

  removeAnswer() {
    let wd='';
    const ans=this.mWord;
    for (let i=0; i<ans.length; i++) {
      const code=ans.charCodeAt(i);
      wd +=
        (code>=0x40 && code<0x40+26) ? 'A' :
        (code>=0x60 && code<0x60+26) ? 'a' : ans.charAt(i);
    }
    this.mWord=wd;
  } // Clue::removeAnswer()

  // charAt(x,y) Helper function to return the letter at grid coord x,y
  charAt(x:number, y:number) : string
  {
    const len=this.mWord.length;
    if ((this.mDownQ && (x!==this.mSx || y<this.mSy || y>=this.mSy+len))
    ||  (!this.mDownQ && (y!==this.mSy || x<this.mSx || x>=this.mSx+len)))
      return '';
    else
      return this.mDownQ ? this.mWord[y-this.mSy] : this.mWord[x-this.mSx];
  } // Clue::charAt()

  clueHTML() : string
  {
    let html="<b>"+this.mLabel+".</b> "+this.mClue+" <span class='clueLC'>"+this.mLetterCountStr+"</span>";
    if (this.mPtValue>K.DefaultPtVal)
      html+=' <span class="bonus">+'+(this.mPtValue-K.DefaultPtVal)+'</span>';

    return html
  } // Clue::clueHTML()

  setClaimedBy(id:number) { this.mClaimedBy=id;  }

  setClueEle(ele:HTMLElement) { this.mClueEle=ele; }


  //-----------------------------------------------------------------
  //
  //░░░█▀▀░█▀▀░▄▀▄░█░█░█▀▀░█▀█░█▀▀░█▀▀░█▀▀░█░░░█░█░█▀▀░█▀▀░▄▀░░▀▄░
  //░░░▀▀█░█▀▀░█\█░█░█░█▀▀░█░█░█░░░█▀▀░█░░░█░░░█░█░█▀▀░▀▀█░█░░░░█░
  //░░░▀▀▀░▀▀▀░░▀\░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀░░▀░░▀░░
  //
  //-----------------------------------------------------------------
  // Should only call this once for each set of clues.
  static SequenceClues() : cluelists // For assigning labels to the clues etc and sort them by Across first then Down, in ascending id number.
  {
    // Sort the clues in y-top-to-bottom then x-left-to-right order.
    Clue.Clues.sort((a:Clue, b:Clue)=>{
      return a.sY===b.sY
      ?  (a.sX===b.sX ? (a.downQ ? 1 : -1) : a.sX-b.sX)
      :  (a.sY-b.sY);
    });

    // console.log all the clues before sequencing (for debugging only)
    // for (let i=0; i<Clue.Clues.length; i++) {
    //   const cl = Clue.Clues[i];
    //   window.console.log(cl.label.toString()+": "+cl.mWord+": "+cl.mClue+" "+cl.mLetterCountStr);
    // } // for (i)

    //....................................................................
    //  Assign a label to the clues in sorted order. Also, compute
    //  the bounding box of all clues, for trimming the grid down.
    //....................................................................
    let minx=9e9, miny=9e9, maxx=-9e9, maxy=-9e9;

    let label=0;
    let lastcl:Clue|null=null;
    for (let i=0; i<Clue.Clues.length; i++) {
      const cl = Clue.Clues[i];
      if (cl.sX<minx) minx=cl.sX;
      if (cl.sY<miny) miny=cl.sY;
      const endX=cl.endX;
      const endY=cl.endY;
      if (endX>maxx) maxx=endX;
      if (endY>maxy) maxy=endY;
      if (!lastcl || cl.sX!==lastcl.sX || cl.sY!==lastcl.sY) label++;  // a label would have to reused for words that share the same starting position.
      cl.mLabel = label;
      lastcl=cl;
    } // for (i)

    // Sort the clues a second time, this time across-down then in ascending label order.
    Clue.Clues.sort((a:Clue, b:Clue)=>{
      return a.downQ!==b.downQ ? (a.downQ ? 1 : -1) : a.label-b.label;
    });

    // Put the across and down clues in 2 separate arrays for convenience.
    const _2arrays:cluelists={aclues:[], dclues:[]};

    // Loop to put the clues into the two arrays.
    // Trim the coordinates to shift the grid as tightly
    // towards the top-left corner as possible.
    let cllist=_2arrays.aclues;  // add clue strings to the aclues array first. (until we move onto down clues)
    let acrossQ=true;
    // window.console.log("Across:");
    for (let i=0; i<Clue.Clues.length; i++) {
      const cl = Clue.Clues[i];
      cl.mSx-=minx;               // trim x start coord.
      cl.mSy-=miny;               // trim y start coord.
      if (acrossQ && cl.downQ) {
        // window.console.log("Down:");
        cllist=_2arrays.dclues;  // from now on, add the clue strings to the dclues array.
        acrossQ=false;
      }
      // cllist.push("<em>"+cl.label.toString()+"</em> "+cl.mWord+": "+cl.mClue+" "+cl.mLetterCountStr);
      cllist.push(cl);
    } // for (i)
    Clue.GridW=maxx-minx+1;
    Clue.GridH=maxy-miny+1;

    // Create the grid cells from scratch.
    const cells:GridCell[][]=Clue.Cells=[];
    for (let r=0; r<Clue.GridH; r++) {
      const row:GridCell[]=cells[r]=[];
      for (let c=0; c<Clue.GridW; c++)
        row[c]=new GridCell(c,r);
    } // for (r)

    for (let i=0; i<Clue.Clues.length; i++) {
      const cl = Clue.Clues[i];
      let x=cl.sX, y=cl.sY;
      for (let n=0; n<cl.mWord.length; n++) {
        cells[y][x].addClue(cl, cl.mWord[n], cl.mBrks[n]);
        if (n===0) cells[y][x].setLabel(cl.label);
        if (cl.downQ) y++; else x++;
      }
    } // for (i)
    return _2arrays;
  } // Clue.SequenceClues()


  private static hashCode(s:string, hash:number=0) : number
  {
    if (s.length>0)
      for (let i=0; i<s.length; i++) {
        let code = s.charCodeAt(i);
        if (code>256)
          hash = (((hash<<5) - hash) + (code>>8))|0;
        hash = (((hash<<5) - hash) + (code&255))|0;
      } // for (i)
    return hash>>>0;
  } // CWA.hashCode() //

  // Save all filled cells to a cookie so that we could recover the grid
  // entries in case of an accidental refresh. Mainly for mobile devices
  // during the xword challenge game.
  static SaveGridEntries()
  {
    let gamehash=0; // to identify which xword grid we are saving for.
    for (let i=0; i<Clue.Clues.length; i++) {
      gamehash = Clue.hashCode(Clue.Clues[i].mClue, gamehash);
    }
    let entries='';
    for (let r=0; r<Clue.Cells.length; r++) {
      if (r) entries+='\n';
      const row =Clue.Cells[r];
      for (let c=0; c<row.length; c++) {
        const entry=row[c].entry;
        entries+=entry ? entry : '_';
      }
    }
    SetCookie(K.CK_GameSave+Clue.GridW.toString()+'x'+Clue.GridH.toString()+':'+gamehash, entries);
  } // Clue.SaveGridEntries()

  static LoadGridEntries()
  {
    let gamehash=0; // to identify which xword grid we are saving for.
    for (let i=0; i<Clue.Clues.length; i++) {
      gamehash = Clue.hashCode(Clue.Clues[i].mClue, gamehash);
    }

    const gamesaved = GetCookie(K.CK_GameSave+Clue.GridW.toString()+'x'+Clue.GridH.toString()+':'+gamehash);
    if (gamesaved) {
      const rws = gamesaved.split('\n');
      if (rws.length===Clue.GridH) {
        for (let r=0; r<rws.length; r++) {
          if (rws[r].length===Clue.GridW) {
            for (let c=0; c<rws[r].length; c++) {
              const e=rws[r][c][0];
              Clue.Cells[r][c].setEntry(e==='_' ? '' : e);
            } // for (c)
          } // if (rws[r].length===
        } // for (r)
      } // if (rws.length===
    } // if (gamesaved)
  } // Clue.LoadGridEntries()
} // class Clue

class AClue extends Clue { constructor(x:number, y:number, ans:string, clue:string) {super(x,y,ans,clue,false);}}
class DClue extends Clue { constructor(x:number, y:number, ans:string, clue:string) {super(x,y,ans,clue,true);}}








//=================================================================
//     ______
//    / ____/
//   / / __
//  / /_/ /   : The Game Namespace
//  \____/
//
//=================================================================
class G
{
  static Canv:      HTMLCanvasElement|null=null;
  static ACluesDiv: HTMLDivElement|null   =null;
  static DCluesDiv: HTMLDivElement|null   =null;
  static ScoresDiv: HTMLDivElement|null   =null;
  static XwordDiv:  HTMLDivElement|null   =null;
  static KeyBrdDiv: HTMLDivElement|null   =null;

  static FocusedClue: Clue|null    = null;
  static FocusedCell: GridCell|null= null;
  static ClueLists: cluelists = {dclues:[],aclues:[]};
  static CanvasResScale:number = window.devicePixelRatio || 1;
  static CurrPlayer: number=0;
  static NPlayers=3;
  static Score:number[]=[];
  static ScoreBtns:HTMLButtonElement[]=[];

  static GameClockTimer:number=-1;
  static GameClockStart:number=0;

  static Options:number = 0; //K.OP_KeepEntries; //K.OP_RevealAll;
  static GameEndedQ = false;
  static HasRealKbdQ= false; // false until proven o.w.
  static VKeyBrdPos=K.KBP_Top;

  static ClearClueUncheckedEntries(toblur: Clue, ignoreKeepEntries:boolean=false) : GridCell|null
  {
    let firstUnCheckedCell: GridCell|null =null;
    let x=toblur.sX;
    let y=toblur.sY;
    for (let i=0; i<toblur.word.length; i++) {
      const cell = Clue.Cells[y][x];
      if (cell.entry && (cell.entry!==toblur.word[i] || !cell.checkedQ)) {
        if (!firstUnCheckedCell) firstUnCheckedCell=cell;
        if (ignoreKeepEntries || !(G.Options&K.OP_KeepEntries))
          cell.setEntry('');
      }
      if (toblur.downQ) y++; else x++;
    } // for (i)
    return firstUnCheckedCell;
  } // G.ClearClueUncheckedEntries()

  static GameReadyQ() : boolean
  {
    return G.ClueLists!==null
        && G.ClueLists.aclues!==null && G.ClueLists.dclues!==null
        && G.DCluesDiv!=null && G.ACluesDiv!==null;
  } // G.GameReadyQ()

  //---------------------------------------------------------------------
  //     ____       _ __      __   _______          ___
  //    / __/    __(_) /_____/ /  / ___/ /_ _____ _/_/ |
  //   _\ \| |/|/ / / __/ __/ _ \/ /__/ / // / -_) / / /
  //  /___/|__,__/_/\__/\__/_//_/\___/_/\_,_/\__/ /_/_/
  //                                            |_/_/
  //  Focus on a different clue.
  //---------------------------------------------------------------------
  static SwitchClue(cl:Clue, redrawQ=true)
  {
    if (G.GameReadyQ()) {
      if (cl) {
        // Check if the clue-line div is visible.
        // Change the enclosing parent div's scrollTop
        // to bring the clue-line to view if necessary.
        let acc_h=0; // accumulator for div heights;
        let cl_h=0;
        const cluelist = ((cl.downQ) ? G.ClueLists.dclues : G.ClueLists.aclues) as Clue[];
        const divlist = ((cl.downQ) ? G.DCluesDiv : G.ACluesDiv) as HTMLElement;
        let div=divlist.firstElementChild as HTMLDivElement;
        acc_h=div.scrollHeight;
        div = div.nextElementSibling as HTMLDivElement;
        for (let i=0; i<cluelist.length && div && div instanceof HTMLDivElement; i++) {
          const r=div.getBoundingClientRect();
          if (cl!==cluelist[i]) {
            acc_h += r.height; //Math.max(div.scrollHeight, div.clientHeight);
            div=div.nextElementSibling as HTMLDivElement;
          }
          else {
            cl_h = r.height;
            break;
          }
        } // for (i)
        if (divlist.scrollTop>acc_h || divlist.scrollTop+divlist.clientHeight<acc_h+cl_h)
          divlist.scrollTop=acc_h;
      } // if (cl)

      if (cl!==G.FocusedClue) {
        if (G.FocusedClue) {  // defocusing clue should have all unchecked grid cell entries cleared.
          const toblur = G.FocusedClue;
          G.ClearClueUncheckedEntries(toblur);
          // let x=toblur.sX;
          // let y=toblur.sY;
          // for (let i=0; i<toblur.word.length; i++) {
          //   const cell = Clue.Cells[y][x];
          //   if (cell.entry && (cell.entry!==toblur.word[i] || !cell.checkedQ)) {
          //     if (!(G.Options&K.OP_KeepEntries)) cell.setEntry('');
          //   }
          //   if (toblur.downQ) y++; else x++;
          // } // for (i)
          if (toblur.clueEle) {
            RemoveClass(toblur.clueEle, K.CL_ActiveClue);
          }

          if (G.Options&K.OP_KeepEntries) {
            Clue.SaveGridEntries();
          }
        }
        G.FocusedClue=cl;
        if (cl) {
          let x=cl.sX;
          let y=cl.sY;
          for (let i=0; i<cl.word.length; i++) {
            const cell = Clue.Cells[y][x];
            if (!cell.checkedQ) {
              G.FocusedCell=cell;
              break;
            }
            if (cl.downQ) y++; else x++;
          }
          if (cl.clueEle) {
            AddClass(cl.clueEle, K.CL_ActiveClue);
          }
        } // if (cl)
        const cells=Clue.Cells;
        for (let r=0; r<cells.length; r++) {
          const row = cells[r];
          for (let c=0; c<row.length; c++) {
            const cell = row[c];
            cell.setStyle(cl && cell.inClueQ(cl) ? K.GC_Hilite : 0);
          } // for (c)
        } // for (r)
        if (redrawQ) G.Redraw();
      }
    } // if (G.ClueLists && ..)
  } // G.SwitchClue()

  static CalcGridRect() : DOMRect
  {
    const scl=G.CanvasResScale;
    const cw = G.Canv.width;
    const ch = G.Canv.height;
    const w = cw-4*scl;
    const h = ch-4*scl;
    const sz = Math.min(Math.floor(w/Clue.GridW), Math.floor(h/Clue.GridH));
    const sft = Math.min((cw-sz*Clue.GridW)>>1, (ch-sz*Clue.GridH)>>1);
    return new DOMRect(sft, sft, sz*Clue.GridW, sz*Clue.GridH);
  } // G.CalcGridRect()


  //------------------------------------------------------------
  //      ____           __
  //     / __ \___  ____/ /________ __      __
  //    / /_/ / _ \/ __  / ___/ __ `/ | /| / /
  //   / _, _/  __/ /_/ / /  / /_/ /| |/ |/ /
  //  /_/ |_|\___/\__,_/_/   \__,_/ |__/|__/
  //
  //------------------------------------------------------------
  static Redraw()
  {
    if (G.Canv===null) return;

    const scl = G.CanvasResScale;
    const cvr = G.CalcGridRect();
    const w = cvr.width;
    const h = cvr.height;
    const sz = w/Clue.GridW;
    const thin = 1*scl;
    const thick= 4*scl;

    const ctx = G.Canv.getContext("2d") as CanvasRenderingContext2D;
    ctx.setTransform(1,0,0,1,cvr.left,cvr.top);
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle="#000";
    ctx.lineWidth=thin;
    ctx.textBaseline="top";
    ctx.font=Math.floor(sz/3).toString()+"px Arial";


    const cells = Clue.Cells;
    for (let r=0; r<Clue.GridH; r++) {
      for (let c=0; c<Clue.GridW; c++) {
        const cell=cells[r][c];
        if (cell.unusedQ) continue;

        const hilitedClueQ = cell.inClueQ(G.FocusedClue);
        const focusedCellQ = hilitedClueQ && G.FocusedCell===cell;
        const t=r*sz;
        const l=c*sz;
        const cellbg =
          cell.unusedQ ? "#000" :
          focusedCellQ ? "#fe0" :
          hilitedClueQ ? "#ffc" : "#fff";


        ctx.fillStyle=cellbg;
        ctx.fillRect(l, t, sz, sz);
        ctx.fillStyle="#000";
      } // for (c)
    } // for (r)

    ctx.lineWidth=thin;
    ctx.beginPath();
    for (let r=0; r<Clue.GridH; r++) {
      const t=r*sz;
      ctx.moveTo(0, t);
      ctx.lineTo(Clue.GridW*sz, t);
    }
    for (let c=0; c<Clue.GridW; c++) {
      const l=c*sz;
      ctx.moveTo(l, 0);
      ctx.lineTo(l, Clue.GridH*sz);
    }
    ctx.stroke();

    for (let r=0; r<Clue.GridH; r++) {
      for (let c=0; c<Clue.GridW; c++) {
        const cell=cells[r][c];
        if (!cell.unusedQ) {
          const t=r*sz;
          const l=c*sz;

          if (cell.label) {
            ctx.fillText(cell.label.toString(), l+2, t+2, sz);
          }
          // Draw the internal word boundaries
          if (cell.wdBoundary) {
            if (cell.wdBoundary&K.BD_AWordStr) {
              ctx.save();
              ctx.lineWidth=thick;
              ctx.beginPath();
              ctx.moveTo(l, t);
              ctx.lineTo(l, t+sz);
              ctx.stroke();
              ctx.restore();
              // ctx.lineWidth=0.5*scl;
            }
            if (cell.wdBoundary&K.BD_DWordStr) {
              ctx.save();
              ctx.lineWidth=thick;
              ctx.beginPath();
              ctx.moveTo(l, t);
              ctx.lineTo(l+sz, t);
              ctx.stroke();
              ctx.restore();
              // ctx.lineWidth=0.5*scl;
            }
            if (cell.wdBoundary&K.BD_AAftHyphen) {
              ctx.lineWidth=thin;
              ctx.beginPath();
              ctx.moveTo(l-sz/10, t+sz/2);
              ctx.lineTo(l+sz/10, t+sz/2);
              ctx.stroke();
            }
            if (cell.wdBoundary&K.BD_DAftHyphen) {
              ctx.lineWidth=thin;
              ctx.beginPath();
              ctx.moveTo(l+sz/2, t-sz/10);
              ctx.lineTo(l+sz/2, t+sz/10);
              ctx.stroke();
            }
          } // if (cell.wdBoundary)

          // if the grid cell is filled, draw the letter entry.
          if (cell.entry || (G.Options&K.OP_RevealAll)) {
            ctx.save();
            ctx.font=(cell.checkedQ ? "bold " : "")+(sz*0.6)+"px Arial";
            ctx.textBaseline="middle";
            ctx.textAlign="center";
            ctx.fillText(
              (G.Options&(K.OP_RevealAll|K.OP_KeepEntries))===K.OP_RevealAll
              ? cell.answer
              : cell.entry,
              l+sz/2, t+sz/2);
            ctx.restore();
          } // if (cell.entry)
        } // if (!unused)
      } // for (c)
    } // for (r)
  } // G.Redraw()



  //-------------------------------------------------------------------------------
  //    __  __        __     __      ___  __                  ____
  //   / / / /__  ___/ /__ _/ /____ / _ \/ /__ ___ _____ ____/ __/______  _______
  //  / /_/ / _ \/ _  / _ `/ __/ -_) ___/ / _ `/ // / -_) __/\ \/ __/ _ \/ __/ -_)
  //  \____/ .__/\_,_/\_,_/\__/\__/_/  /_/\_,_/\_, /\__/_/ /___/\__/\___/_/  \__/
  //      /_/                                 /___/
  //
  // Called after a clue check.
  //  1) recalculate the claimed scores for each player.
  //  2) update the score buttons' html contents
  //  3) detects the game end state and show the splash div.
  //-------------------------------------------------------------------------------
  static UpdatePlayerScores()
  {
    if (G.Options&(K.OP_KeepEntries|K.OP_Solitary)) {
      for (let i=0; i<G.ScoreBtns.length; i++) {
        G.ScoreBtns[i].hidden=true; //innerHTML = "<span style='float:right;'>"+scores[i]+"</span>";
      }
    }
    else {
      const scores:number[]=G.Score;
      for (let i=0; i<G.NPlayers; i++) scores[i]=0;

      let allClaimedQ=true;

      for (let i=0; i<Clue.Clues.length; i++) {
        const cl=Clue.Clues[i];
        if (cl.claimedBy>=0 && cl.claimedBy<G.NPlayers) {
          scores[cl.claimedBy]+=cl.ptValue;
        }
        else
          allClaimedQ=false;
      } // for (i)

      let maxScore=-1, winner=0;  // winner is in bits.
      for (let i=0; i<G.ScoreBtns.length; i++) {
        G.ScoreBtns[i].hidden=false;
        G.ScoreBtns[i].innerHTML = "<span style='float:right;'>"+scores[i]+"</span>";
        if (scores[i]>maxScore) {
          maxScore=scores[i];
          winner=(1<<i);
        }
        else if (scores[i]===maxScore) {
          winner|=(1<<i);
        }
      } // for (i)

      if (allClaimedQ && winner)
      {
        const div = byId("infoDiv");
        let nwinners=0;
        let winnerTxt='';
        let winid=-1;
        for (let id=0; id<G.NPlayers; id++) {
          if (winner & (1<<id)) {
            if (winnerTxt) winnerTxt+=' & ';
            winnerTxt+=(id + 1).toString();
            nwinners++;
            winid=id;
          }
        }
        if (nwinners===1)
          div.innerHTML="Team "+(winid+1)+" is the winner!";
        else {
          if (nwinners===2)
            div.innerHTML="We have a tie between Team "+winnerTxt+"!";
          else
            div.innerHTML="We have a "+nwinners+" way tie!";
        }
        div.hidden=false;
        div.onclick=()=>{div.hidden=true;}

        G.GameEndedQ=true;
      }
    }
  } // G.UpdatePlayerScore()


  static CheckFocusedClue(claimer:number) : boolean // returns true if the focused clue is fully filled.
  {
    if (!G.FocusedClue) return false;

    const cl=G.FocusedClue;
    const cells = Clue.Cells;
    let x=cl.sX, y=cl.sY;
    // 1st pass. Check if the entire word is filled first.
    let wordfilledQ=true;
    for (let i=0; i<cl.word.length && wordfilledQ; i++) {
      if (!cells[y][x].entry) wordfilledQ=false;
      if (cl.downQ) y++; else x++;
    } // for (i)

    if (wordfilledQ) {
      let x=cl.sX, y=cl.sY;
      let noMistakesQ=true;
      for (let i=0; i<cl.word.length; i++) {
        if (cells[y][x].check()) {
          if (cells[y][x].clues.length>1) {  // This letter is correct. Check secondary clue too, if any.
            const sideclues=cells[y][x].clues;
            for (let n=0; n<sideclues.length; n++) {
              const cl2=sideclues[n]; // a secondary clue
              if (cl2!==cl && cl2.claimedBy<0) {  // cl2 is not claimed yet.
                // check to see if cl2 is now completely filled with this new correct letter added.
                let x2=cl2.sX, y2=cl2.sY;
                let cl2NoMistakesQ=true;
                for (let i2=0; i2<cl2.word.length && cl2NoMistakesQ; i2++) {
                  if (!cells[y2][x2].check()) cl2NoMistakesQ=false;
                  if (cl2.downQ) y2++; else x2++;
                } // for (i2)
                if (cl2NoMistakesQ) { // cl2 is now completely filled and all letters are correct!
                  cl2.setClaimedBy(claimer);
                  G.RebuildClueDivs();  // this call is potentially a waste, but still necessary because while cl2 is now claimed, cl might not be entirely correct!
                }
              } // if (cl2!==cl && cl2.claimedBy<0)
            } // for (n)
          } // if (cells[y][x].clues.length>1)
        }
        else noMistakesQ=false;
        if (cl.downQ) y++; else x++;
      } // for (i)
      if (noMistakesQ) {
        cl.setClaimedBy(claimer);
        G.RebuildClueDivs();
      }
      else if (G.FocusedClue && G.FocusedClue.clueEle) {
        RemoveClass(G.FocusedClue.clueEle, K.CL_ActiveClue);
      }
      G.FocusedCell=null;
      G.FocusedClue=null;
      G.UpdatePlayerScores();
      G.Redraw();
    } // if (wordfilledQ) .. //
    return wordfilledQ;
  } // G.CheckFocusedClue()

  static ChangePlayer(e:Event|number)
  {
    let player=-1;
    if (typeof(e)==='number') {
      player=e;
    }
    else if (e && e.target instanceof HTMLButtonElement) {
      const btn=e.target as HTMLButtonElement;
      let parts=btn.id.match(/^score(\d)$/);
      if (parts && parts[1]) {
        player=+parts[1];
      }
    }

    if (player>=0 && player<G.NPlayers) {
      for (let i=0; i<G.NPlayers; i++) {
        if (i===player) AddClass(G.ScoreBtns[i], "currPlay");
        else RemoveClass(G.ScoreBtns[i], "currPlay");
        RemoveClass(G.ScoreBtns[i], "border"+i);
      }

      if (G.CurrPlayer!==player) {
        G.GameClockStart=performance.now();
        G.ScoreBtns[G.CurrPlayer].innerHTML=G.Score[G.CurrPlayer].toString();
      }
      if (G.GameClockTimer===-1) {
        G.GameClockStart=performance.now();
        G.GameClockTimer=window.setTimeout(G.UpdateClockDisplay, K.ClockTick);
      }
      G.CurrPlayer=player;
    }
  } // G.ChangePlayer()

  static ShowHideKeyBrdDiv(showQ:boolean)
  {
    if (G.KeyBrdDiv) {
      const hide=G.HasRealKbdQ || !showQ;
      G.KeyBrdDiv.hidden=hide;

      G.KeyBrdDiv.style.display=hide ? "none" : "grid";
      if (!hide)
        G.AdjKeyBrdDivTop();  // for iOS safari weirdness.
    }
  } // G.ShowHideKeyBrdDiv()


  //---------------------------------------------------------------
  //
  //  PointerDown and KeyDown handlers
  //
  //---------------------------------------------------------------
  static OnPointerDown(e: Event)
  {
    let mouseQ=true;
    if (e instanceof PointerEvent && (e.pointerType==="touch" || e.pointerType==="pen"))
      mouseQ=false;

    const bdr = G.Canv.getBoundingClientRect();
    const cLeft=bdr.left;

    const scrollTop = ((document.documentElement.clientHeight) ? document.documentElement : document.body).scrollTop;
    const cTop=bdr.top+scrollTop; //document.body.scrollTop;

    // these are in css px units from event.
    const posX = (<MouseEvent>e).pageX-cLeft;  // convert into canvas offsets.
    const posY = (<MouseEvent>e).pageY-cTop;
    const scl = G.CanvasResScale;
    const cvX=posX*scl, cvY=posY*scl;   // scaled by CanvasResScale;

    const cvr = G.CalcGridRect();
    const col = Math.floor((cvX-cvr.left)*Clue.GridW/cvr.width);
    const row = Math.floor((cvY-cvr.top)*Clue.GridH/cvr.height);
    if (col>=0 && col<Clue.GridW
    &&  row>=0 && row<Clue.GridH)
    {
      const cell = Clue.Cells[row][col];
      const clues = cell.clues;
      if (clues.length>0) { // clicked on a cell with one or more clues
        if (clues.length===2) {
          if (clues.indexOf(G.FocusedClue)<0) { // none of them active yet.
            G.SwitchClue(clues[0],false);       // activate the 0th one.
          }
          else if (G.FocusedCell===cell) {      // toggle between the 2 clues.
            if (!(!mouseQ && !G.HasRealKbdQ && G.KeyBrdDiv.hidden)) // the first touch should only bring up the keyboard
              G.SwitchClue(clues[clues[0]===G.FocusedClue ? 1 : 0], false);
          }
        }
        else
          G.SwitchClue(clues[0], false);
      }
      else {
        G.SwitchClue(null, false);
      }

      if (!cell.unusedQ && !cell.checkedQ) {
        G.FocusedCell = cell;
      }
      if (!mouseQ) G.ShowHideKeyBrdDiv(!cell.unusedQ);
      G.Redraw();
    }
    else {
      G.ShowHideKeyBrdDiv(false);
      G.SwitchClue(null, true);
    }
  } // G.OnPointerDown() //

  static OnKeyDown(ev: Event)
  {
    const e=ev as KeyboardEvent;
    if (e.isComposing || e.keyCode===229) return;

    function __shiftFocusedCell(delta:number, redrawQ=true) {
      if (G.FocusedCell) {
        let x=G.FocusedCell.x;
        let y=G.FocusedCell.y;
        let dx=delta, dy=0;
        if (G.FocusedClue.downQ) {
          dx=0; dy=delta;
        }
        const oFocus=G.FocusedCell;
        G.FocusedCell=null;
        do {
          x+=dx; y+=dy;
          if (G.FocusedClue.charAt(x, y) && !Clue.Cells[y][x].checkedQ) {
            G.FocusedCell=Clue.Cells[y][x];
            break;
          }
        } while (G.FocusedClue.charAt(x,y));
        if (!G.FocusedCell && !oFocus.checkedQ) G.FocusedCell=oFocus;
        if (redrawQ) G.Redraw();
      } // if (G.FocusedCell
    } // __shiftFocusedCell()

    if (!e.ctrlKey && !e.metaKey && e.key.match(/^[a-zA-Z]$/) && G.FocusedClue && G.FocusedCell) {
      const k=e.key.toUpperCase();
      G.FocusedCell.setEntry(k);
      __shiftFocusedCell(1);
    }
    else if (e.key==='Backspace' && G.FocusedClue && G.FocusedCell) {
      if (G.FocusedCell.entry) {
        G.FocusedCell.setEntry('');
      }
      else {
        __shiftFocusedCell(-1, false);
        if (G.FocusedCell && G.FocusedCell.entry)
          G.FocusedCell.setEntry('');
      }
      G.Redraw();
    }
    else if (e.key==='Left' || e.key==='ArrowLeft'
    ||       e.key==='Up' || e.key==='ArrowUp')
    {
      if (G.FocusedClue)
        __shiftFocusedCell(-1);
    }
    else if (e.key==='Right' || e.key==='ArrowRight'
          || e.key==='Down' || e.key==='ArrowDown')
    {
      if (G.FocusedClue)
        __shiftFocusedCell(1);
    }
    else if ((G.Options&K.OP_KeepEntries)===0
          && ((e.ctrlKey && e.key==='c')    // Ctrl-c means check entries.
              || (e.key.match(/^[1-9]$/i))  // 1-9 keys for reassigning score to another team by the curator during a game
              || ((G.Options&(K.OP_EnterKeyChk|K.OP_Solitary))!==0 && (e.key==="Enter" || e.key==="Return")) // enter/return key means check entries.
             )
            )
    {
      if (G.FocusedClue) {
        if (e.key==='c' || e.key==='C' || e.key==="Enter" || e.key==="Return") {
          if (G.CheckFocusedClue(G.CurrPlayer)) {
            // change player only if the clue is fully filled.
            G.ChangePlayer((G.CurrPlayer+1)%G.NPlayers);
            if (!G.KeyBrdDiv.hidden)
              G.ShowHideKeyBrdDiv(false);
          }
        }
        else {
          const code = e.key.charCodeAt(0)-0x31;
          if (code>=0 && code<G.NPlayers)
          {  // ctrl-'digit' is for reassigning answer score. Does not change current player.
            const claimer=e.key.charCodeAt(0)-0x31;
            G.CheckFocusedClue(claimer);
          }
        }
      }
    }
    else if ((G.Options&K.OP_RevealBtn)!==0
          && e.ctrlKey && e.key.toLowerCase()==='a')  // Ctrl-a means reveal all.
    {
      if ((G.Options & K.OP_RevealAll)===0)
        G.Options|=K.OP_RevealAll;
      else
        G.Options&=(~K.OP_RevealAll);
      e.preventDefault();
      G.Redraw();
    }
    else if (e.key==='Esc' || e.key==='Escape') {
      if (e.shiftKey) {
        for (let i=0; i<Clue.Clues.length; i++) {
          G.ClearClueUncheckedEntries(Clue.Clues[i], true);
        }
        G.FocusedClue=null;
        G.FocusedCell=null;
        G.Redraw();
      }
      else if (G.FocusedClue) {
        G.FocusedCell = G.ClearClueUncheckedEntries(G.FocusedClue, true);
        Clue.SaveGridEntries();
        G.Redraw();
      }
    }

    if (G.HasRealKbdQ && !G.KeyBrdDiv.hidden)
      G.ShowHideKeyBrdDiv(false);
  } // G.OnKeyDown()


  static OnVKeyClick(e:Event)
  {
    if (e.target instanceof HTMLButtonElement) {
      const btn=e.target as HTMLButtonElement;
      const _idx=btn.id.indexOf('_key');
      const key=btn.id.substring(0, _idx);
      if (key==='close') {
        G.ShowHideKeyBrdDiv(false);
      }
      else if (key==='kbdpos') {
        G.VKeyBrdPos ^= 1;
        SetCookie(K.CK_VKeyBrdPos, G.VKeyBrdPos===K.KBP_Bot ? 'B' : 'T');
        G.AdjKeyBrdDivTop();
      }
      else {
        const opts={key:key, ctrlKey:false};
        if (key==='Enter') {
          opts.key='c';
          opts.ctrlKey=true;
        }
        const kbEvt= new KeyboardEvent('keydown', opts);
        G.OnKeyDown(kbEvt);
      }
    }
  } // G.OnVKeyClick()

  static AdjKeyBrdDivTop() {
    if (G.VKeyBrdPos===K.KBP_Bot) {
      const r = G.XwordDiv.getBoundingClientRect();
      const gridsz = Math.min(r.width, r.height);
      G.KeyBrdDiv.style.top = (r.bottom-r.width*0.3).toString()+"px";
    }
    else {
      G.KeyBrdDiv.style.top="0px";
    }
  } // G.AdjKeyBrdDivTop() //

  static OnResize()
  {
    if (G.Canv && G.XwordDiv) {
      // const parent = D.Canv.parentElement as HTMLElement;
      // const r = parent.getBoundingClientRect();
      // const w = Math.floor(window.innerWidth - 7);
      // const h = Math.floor(window.innerHeight - 92);
      const r = G.XwordDiv.getBoundingClientRect();
      const scl=G.CanvasResScale;
      const w = Math.floor(r.width)*scl;
      const h = Math.floor(r.height)*scl;
      G.Canv.width  = w;
      G.Canv.height = h;
      G.Canv.style.width = (w/scl).toString()+"px";
      G.Canv.style.height= (h/scl).toString()+"px";

      if (G.KeyBrdDiv) {
        G.KeyBrdDiv.style.width = r.width.toString()+"px";
        // G.KeyBrdDiv.style.gridTemplateColumns="repeat(10,"+(r.width/10)+"px)";
        // let b:Element;
        // for (b=G.KeyBrdDiv.firstElementChild; b!==null; b=b.nextElementSibling) {
        //   if (b instanceof HTMLButtonElement) {
        //     const btn = b as HTMLButtonElement;
        //     btn.style.width=(r.width/10-4).toString()+"px";
        //   }
        // }
        if (!G.KeyBrdDiv.hidden)
          G.AdjKeyBrdDivTop();
      }

      G.Redraw();
    }
  } // G.OnResize()

  static RebuildClueDivs()
  {
    if (G.ACluesDiv && G.DCluesDiv && G.ClueLists) {
      const cluestrs = G.ClueLists;

      function __mkDiv(txt:string) {
        const div = document.createElement('div') as HTMLDivElement;
        div.innerHTML=txt;
        return div;
      } // __mkDiv()

      let cl = cluestrs.aclues;
      let div = G.ACluesDiv;
      div.innerHTML="<div>Across:</div>"; //appendChild(__mkDiv("Across:"));
      for (let dir=0; dir<2; dir++) {
        for (let i=0; i<cl.length; i++) {
          const clue_i=cl[i];
          const cluediv = __mkDiv(clue_i.clueHTML());
          cluediv.className="clueLine";
          if (clue_i.claimedBy>=0) {
            if (G.Options&K.OP_Solitary)
              cluediv.className+=" claimed";
            else
              cluediv.className+=" winner"+clue_i.claimedBy;
          }
          cluediv.addEventListener('click', ()=>{G.SwitchClue(clue_i);});
          // Not good -> cluediv.ontouchstart = ()=>{G.ShowHideKeyBrdDiv(true);}
          clue_i.setClueEle(cluediv);
          div.appendChild(cluediv);
        } // for (i)
        if (dir===0) {
          cl=cluestrs.dclues;
          div=G.DCluesDiv;
          div.innerHTML="<div>Down:</div>"; //div.appendChild(__mkDiv("Down:"));
        }
      } // for (dir)
    } // if (G.ACluesDiv && G.DCluesDiv)
  } // G.RebuildClueDivs()

  static UpdateClockDisplay()
  {
    if (G.Options&K.OP_KeepEntries) return;

    G.GameClockTimer=-1;
    const sec = Math.floor((performance.now()-G.GameClockStart)/1000);

    if (G.CurrPlayer>=0 && G.CurrPlayer<G.NPlayers && sec>0) {
      const btn = G.ScoreBtns[G.CurrPlayer];
      if (sec>30) AddClass(btn, "border"+G.CurrPlayer);
      else        RemoveClass(btn, "border"+G.CurrPlayer);
      btn.innerHTML="<span class='lcd'>"+sec+"</span><span style='float:right;'>"+G.Score[G.CurrPlayer]+"</span>";
    }
    if (!G.GameEndedQ && sec<99)
      G.GameClockTimer=window.setTimeout(G.UpdateClockDisplay, K.ClockTick);
  } // G.UpdateClockDisplay()


  static ParseXwordFile(xword:string)
  {
    const lines = xword.split(/\r\n|\n/);
    let nclues=0;
    for (let i=0; i<lines.length; i++) {
      const pts=lines[i].match(/^\s*(?:new\s*)?(AClue|DClue)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*\"([a-zA-Z-]+)\"\s*,\s*\"([^"]+)\"\s*(,\s*(\d+)\s*)?\)/);
      if (pts) {
        new Clue(+pts[2],+pts[3],pts[4],pts[5].trim(),pts[1]==='DClue', pts[6] ? +pts[7] : 10);
        nclues++;
      }
      else {
        const opt=lines[i].match(/^\s*(KeepEntries|RevealAll|RevealBtn|EnterKeyChk|Solitary)\s*$/i);
        if (opt) {
          switch (opt[1]) {
          case 'KeepEntries':
            G.Options&=(~(K.OP_RevealAll|K.OP_RevealBtn));
            G.Options|=K.OP_KeepEntries;
            break;
          case 'RevealAll':
            if ((G.Options&K.OP_KeepEntries)===0)
              G.Options|=(K.OP_RevealAll|K.OP_RevealBtn);
            break;
          case 'EnterKeyChk':
            if ((G.Options&K.OP_KeepEntries)===0)
              G.Options|=K.OP_EnterKeyChk;
            break;
          case 'Solitary':
            G.Options|=K.OP_Solitary;
            break;
          case 'RevealBtn':
            if ((G.Options&K.OP_KeepEntries)===0)
              G.Options|=K.OP_RevealBtn;
            break;
          } // switch(opt[1])
        } // if (opt)
      }
    } // for (i)

    if (nclues) {
      G.PrepCluesForGame();
      if (G.Options&(K.OP_Solitary|K.OP_KeepEntries))
        G.UpdatePlayerScores();
    }
  } // G.ParseXwordFile()

  static PrepCluesForGame()
  {
    if (G.Options&K.OP_KeepEntries) {
      for (let i=0; i<Clue.Clues.length; i++) {
        Clue.Clues[i].removeAnswer();
      } // for (i)
    }
    G.ClueLists=Clue.SequenceClues();
    G.RebuildClueDivs();

    if (G.Options&K.OP_KeepEntries) {
      Clue.LoadGridEntries();
      for (let i=0; i<G.ScoreBtns.length; i++) {
        G.ScoreBtns[i].hidden=true;
      }
    }
    // if (Clue.GridH<15 && Clue.GridW<15)   // smaller non-competition game. accepts enter key checks.
    // {
    //   G.Options|=K.OP_EnterKeyChk;
    //   G.Options|=K.OP_RevealBtn;
    // }

    window["onkeydown"] = (e:Event)=>{
      G.HasRealKbdQ=true;
      G.OnKeyDown(e);
    };
    window["onresize"] = G.OnResize;

    G.Canv["onpointerdown"] = G.OnPointerDown;
    G.OnResize();
  } // G.PrepCluesForGame()

  static MkHttpReq(url:string)
  {
    if (navigator.onLine) {
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = ()=>{
        if (xhttp.readyState===4 && xhttp.status===200) {
          // Clue.Reset();
          G.ParseXwordFile(xhttp.responseText);
        }
      };
      xhttp.open("GET", url, true);
      xhttp.send();
    }
  } // MkHttpReq()

  static InitPage()
  {
    G.Options=0; //K.OP_KeepEntries;

    //new DClue(4,0, "Necessary","The kind of evil that society gladly put up with");
    // new AClue(0,7,  "AChristmasCarol", "An age old victorian classic that has countless screen adaptations");
    // new AClue(0,0,  "Microsecond", "?");
    // new AClue(0,0,  "Multiracial", "?");
/*
    new DClue(3,0,  "Eddy", "A small current");
    // new DClue(3,0,  "Tidy", "Neat");
    new AClue(0,0,  "YuleLogCake", "A Christmas block for a seasonal bake");
    new DClue(1,0,  "Upward", "Where the (0,1) vector points");
    new AClue(0,3,  "Mary", "Christmas mum");
    new AClue(0,5,  "Idol", "Billy Elish is one");
    new DClue(5,0,  "Occupy", "Fill");
    new AClue(4,4,  "Ap", "Exam series not particularly useful for us?");
    new DClue(9,0,  "Kite", "A quardrilateral with one line of symmetry"); //"Kitt", "The AI automobile in Knight Rider");
    new DClue(3,5,  "Legacy", "Achievements one leaves behind");
    new AClue(12,0, "New", "What year comes after Christmas?");
    new DClue(7,0,  "CircularSection", "Slicing up a sphere gets you a ___");
    new AClue(3,9,  "Chloe", "Exec in greenish poisonous gas without real intake");
    new DClue(9,5,  "Ion",  "A charged particle");
    new DClue(12,0, "Nine", "One over eight");
    new AClue(3,2,  "Decorations", "Mix up coordinates to find baubles and fairy-lights");
    //new AClue(7,5,  "Latex", "To type your Math with");
    new AClue(7,5,  "Lying", "Baby Jesus's posture in his crib?");
    //new DClue(11,5, "gamma", "The 3rd greek letter");
    new DClue(11,4, "XGames", "Extreme sports");
    new DClue(9,9,  "Frutti", "Tutti-___, a colourful confection");
    new AClue(4,14, "VennDiagram", "A usually unremarkable Math illustration with a few ovals."); //"coincident", "?");
    // new AClue(1,12, "abbreviate", "?");
    new DClue(0,7,  "Icing", "Commonly found on top of fruit cakes");
    new AClue(13,5, "Ag", "A good metallic element");
    new DClue(11,13,"kg", "SI unit for mass");
    new AClue(0,9,  "in", "Better out than ___");
    new DClue(5,7,  "nil", "Health benefits from festive food");
    new AClue(7,10, "card", "Greetings on paper");
    new AClue(1,12, "fifty-fifty", "A tie");
    new AClue(11,11,"pine", "A popular choice for Xmas tree");
    new DClue(5,11, "type", "A way of communication using digits");
    new DClue(2,11, "Life", "It means 42"); //"sine", "A trigonometry function");
    // new DClue(2,11, "Time", "Contest foe"); //"sine", "A trigonometry function");
    new AClue(11,9, "semi", "Not entirely, halfway");
    new AClue(0,14, "woe", "Common feeling when coming out from COMC?");
    new AClue(0,7,  "ImaginaryNumber", "An unreal quantity");
    new DClue(14,3, "Tiger", "Club figure is almost a friend of Winnie-the-Pooh, just less good");
    new DClue(13,9, "Minima", "Local or global low points");
*/





    // spare clues
    //new DClue(3,5,  "Logic", "What reasoning is based upon");
    // new AClue(2,0,  "APalindrome", "What is 'Never odd or even'");
    // new DClue(12,0, "Equilateral", "When all sides are equal");
    // new DClue(2, 4, "Diophantine", "Integer equations that props up in contests");
    // new DClue(14,0,"DeMoivreTheorem"


    G.Canv = byId("gfxCanv") as HTMLCanvasElement;
    G.Canv.style.backgroundColor="#000";
    G.XwordDiv = byId("xwordDiv") as HTMLDivElement;
    // G.XwordDiv.onpointerdown = ()=>{G.ShowHideKeyBrdDiv(false);}
    G.ACluesDiv = byId("aCluesDiv") as HTMLDivElement;
    G.DCluesDiv = byId("dCluesDiv") as HTMLDivElement;
    G.ScoresDiv = byId("scoresDiv") as HTMLDivElement;
    G.KeyBrdDiv = byId("kbd") as HTMLDivElement;
    if (G.KeyBrdDiv) {
      G.ShowHideKeyBrdDiv(false);

      const kbpos = GetCookie(K.CK_VKeyBrdPos);
      if (kbpos==='B') G.VKeyBrdPos=K.KBP_Bot;
      else G.VKeyBrdPos=K.KBP_Top;

      let b:Element;
      for (b=G.KeyBrdDiv.firstElementChild; b!==null; b=b.nextElementSibling) {
        if (b instanceof HTMLButtonElement) {
          const btn = b as HTMLButtonElement;
          btn.onclick = G.OnVKeyClick;
        }
      }
    } // if (G.KeyBrdDiv) .. //

    for (let i=0; i<G.NPlayers; i++) {
      const btn=byId("score"+i) as HTMLButtonElement;
      if (btn) {
        G.ScoreBtns.push(btn);
        G.Score.push(0);
        btn.onclick=G.ChangePlayer;
      }
      else {
        G.NPlayers=i;
        break;
      }
    } // for (i)

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    if (urlParams.has('f')) {
      const fparam = urlParams.get('f');
      if (fparam) {
        const xwordfn=fparam.toLowerCase();
        G.MkHttpReq(xwordfn+".dat");
      }
    }
    else {
      new DClue(4, 0, "Lifesaver",  "Sweet hoop that keeps you alive");
      new AClue(0, 4, "Crossword",  "What this is all about");
      new AClue(0, 0, "Bagel",      "High-carb hoop that keeps you stuffed");
      new DClue(0,0,  "Bijection",  "A relation that is invertible");
      new AClue(4,8,  "Rufin",      "Brought to you by...");
      new DClue(8,0,  "withdrawn",  "A detached state");
      new DClue(2,4,  "Opium",      "A narcotic drug made from Poppy extracts");
      // new DClue(2,2,  "utopian",    "Perfection");
      // new DClue(2,4,  "Ocean",      "A vast patch of water");
      new DClue(6,0,  "Kyoto",      "Former capital of Japan");
      new AClue(4,1,  "Ivy",        "A US league that attracts good students");
      new AClue(6,6,  "qua",        "In the capacity of");
      new AClue(0,8,  "nom",        "French name denoting abbreviation");
      new DClue(2,0,  "Ghz",        "Speed unit of contemporary microprocessors");
      // new AClue(2,7,  "axe",        "Fire?");
      new AClue(2,7,  "uxe",        "User experience engineer");
      new AClue(6,0,  "Kew",        "A world-famous botanical garden in London");


      G.PrepCluesForGame();
    }

    // G.ClueLists=Clue.SequenceClues();

    // G.RebuildClueDivs();

    // window.onkeydown = G.OnKeyDown;
    // window.onresize = G.OnResize;
    // G.Canv.onpointerdown = G.OnPointerDown;
    // G.OnResize();
  } // G.InitPage()
} // class G

interface Window {[key:string]:any}
window["initPage"]=G.InitPage;
