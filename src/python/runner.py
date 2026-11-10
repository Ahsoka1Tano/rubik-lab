import json
import linecache
import sys
import traceback


def move(notation):
    """Apply one or more space-separated turns in Singmaster notation."""
    if not isinstance(notation, str):
        raise TypeError("move() expects a string such as \"R U R' U'\".")
    error = _turn(notation)
    if error:
        raise ValueError(error)


class Cube:
    move = staticmethod(move)

    def get_state(self):
        """Return six row-major face strings, indexed by U, R, F, D, L, B."""
        return json.loads(_state())

    def is_solved(self):
        return _solved()

    def reset(self):
        error = _reset()
        if error:
            raise ValueError(error)

    def scramble(self):
        """Apply and return a random sequence of 25 legal turns."""
        error, _, notation = _scramble().partition("\n")
        if error:
            raise ValueError(error)
        return notation


linecache.cache[_filename] = (len(_source), None, _source.splitlines(keepends=True), _filename)
try:
    scope = {"__name__": "__main__", "__file__": _filename, "move": move, "cube": Cube()}
    exec(compile(_source, _filename, "exec"), scope)
except BaseException as error:
    diagnostic = traceback.TracebackException.from_exception(error)
    frames = [frame for frame in diagnostic.stack if frame.filename != "_rubik_runner.py"]
    diagnostic.stack = traceback.StackSummary.from_list(frames)
    line = None
    column = None
    if isinstance(error, SyntaxError) and error.filename == _filename:
        line, column = error.lineno, error.offset
    else:
        for frame in reversed(frames):
            if frame.filename == _filename:
                line = frame.lineno
                break
    sys.stdout.flush()
    sys.stderr.flush()
    _failure("".join(diagnostic.format()).rstrip(), line or 0, column or 0)
finally:
    sys.stdout.flush()
    sys.stderr.flush()
    linecache.cache.pop(_filename, None)
