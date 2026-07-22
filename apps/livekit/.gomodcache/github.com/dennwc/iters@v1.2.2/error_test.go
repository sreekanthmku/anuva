package iters_test

import (
	"errors"
	"testing"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestError(t *testing.T) {
	err := errors.New("test error")
	testit.ExpectIter(t, nil, err, Error[int](err))
	testit.ExpectIterCtx(t, nil, err, Error[int](err))
	testit.ExpectPageIter(t, nil, err, Error[int](err))
	testit.ExpectIterCtx(t, nil, err, ErrorCtx[int](err))
	testit.ExpectPageIter(t, nil, err, ErrorCtx[int](err))
}
