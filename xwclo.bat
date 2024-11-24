@echo off
SETLOCAL
rem **********************************************************************
rem Step 1:  Merge all js files to be closure compiled into one
rem **********************************************************************
echo [1] Merging all js files into $noBuildNum$.alljs for the closure compiler:
copy xword.js + linebreak.txt $closure_in$.injs

rem ***********************************************************************
rem Step 2:  Closure-compile the prepared all-in-one js file
rem ***********************************************************************
echo [2] Calling the closure compiler to generate mmahome_all.clo.js
call closure --compilation_level ADVANCED_OPTIMIZATIONS --js $closure_in$.injs --js_output_file xword_all.clo.js

if %ERRORLEVEL% EQU 0 (
echo Closure compiler finished without error.
echo [3] Inserting xword_all.clo.js into the html file...
rem ***********************************************************************
rem Step 3:  Generate sed script for inserting the compiled js into html
rem ***********************************************************************
@rem *** Note: When adding 3rd party script, be sure to update "closure_externs.js" to include the external functions used.
echo /^^ *^<script src=/ {> $insert$.sed
echo a\>> $insert$.sed
echo ^<script^>>> $insert$.sed
@rem echo r twgl-full.min.js>> $insert$.sed
@rem echo r decimal.min.js>> $insert$.sed
echo r xword_all.clo.js>> $insert$.sed
echo a\>> $insert$.sed
echo ^</script^>>> $insert$.sed
echo d>> $insert$.sed
echo }>> $insert$.sed

  sed -r -f $insert$.sed xword.html > xwdapp.html
rem  goto end

  if %ERRORLEVEL% EQU 0 (
    rem del $insert$.sed
    echo Output html file "xwdapp.html" ready.

    echo [4] Calling html-minifier...
    call html-minifier --remove-comments --minify-css true xwdapp.html -o xwdapp_min.html
    echo [Done] Release ready mmaapp_min.html created.
    echo.

  ) else (
    echo sed step failed.
    echo sed script used:
    echo ----------------------------------------
    type $insert$.sed
    echo ----------------------------------------
    del $insert$.sed
    goto end
  )
) else (
echo closure compiler returned with error code: %ERRORLEVEL%
)

:end

echo ------------------------------------------------------------------
echo [5] Appending the KeepEntries directive to the public game files
echo ------------------------------------------------------------------
copy warmup11.dat warmup11-pub.dat
copy gameon15.dat gameon15-pub.dat
copy game15.dat game15-pub.dat
