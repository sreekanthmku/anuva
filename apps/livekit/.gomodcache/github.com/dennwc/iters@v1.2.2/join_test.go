package iters_test

import (
	"testing"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestJoinIter(t *testing.T) {
	testit.ExpectIter(t, []int(nil), nil, Join[int]())
	testit.ExpectIter(t,
		[]int{1, 2, 3, 4, 5, 6}, nil,
		Join[int](
			Slice([]int{1, 2}),
			Slice([]int{3}),
			Slice([]int{4, 5, 6}),
		),
	)

	testit.ExpectIterCtx(t, []int(nil), nil, JoinCtx[int]())
	testit.ExpectIterCtx(t,
		[]int{1, 2, 3, 4, 5, 6}, nil,
		JoinCtx[int](
			Slice([]int{1, 2}),
			Slice([]int{3}),
			Slice([]int{4, 5, 6}),
		),
	)

	testit.ExpectPageIter(t, []int(nil), nil, JoinPages[int]())
	testit.ExpectPageIter(t,
		[]int{1, 2, 3, 4, 5, 6}, nil,
		JoinPages[int](
			Slice([]int{1, 2}),
			Slice([]int{3}),
			Slice([]int{4, 5, 6}),
		),
	)
}
