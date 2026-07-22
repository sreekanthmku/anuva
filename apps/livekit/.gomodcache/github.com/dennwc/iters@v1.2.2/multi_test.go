package iters_test

import (
	"testing"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestMultiIter(t *testing.T) {
	testit.ExpectIter(t, []int(nil), nil, MultiIter[int](true))
	testit.ExpectIter(t,
		[]int{11, 21, 31, 12, 32, 33}, nil,
		MultiIter[int](true,
			Slice([]int{11, 12}),
			Slice([]int{21}),
			Slice([]int{31, 32, 33}),
		),
	)

	testit.ExpectIterCtx(t, []int(nil), nil, MultiIterCtx[int](true))
	testit.ExpectIterCtx(t,
		[]int{11, 21, 31, 12, 32, 33}, nil,
		MultiIterCtx[int](true,
			Slice([]int{11, 12}),
			Slice([]int{21}),
			Slice([]int{31, 32, 33}),
		),
	)

	testit.ExpectPageIter(t, []int(nil), nil, MultiPageIter[int](true))
	testit.ExpectPageIter(t,
		[]int{11, 21, 31, 12, 32, 33}, nil,
		MultiPageIter[int](true,
			PageSlice([][]int{{11}, {12}}),
			PageSlice([][]int{{21}}),
			PageSlice([][]int{{31}, {32}, {33}}),
		),
	)
}
