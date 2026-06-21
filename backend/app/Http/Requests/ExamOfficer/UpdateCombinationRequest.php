<?php

namespace App\Http\Requests\ExamOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCombinationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId      = $this->attributes->get('school_id');
        $combinationId = $this->route('combination')?->id;

        return [
            'name'              => ['required', 'string', 'max:255'],
            'code'              => ['required', 'string', 'max:30',
                Rule::unique('combinations', 'code')->where('school_id', $schoolId)->ignore($combinationId)],
            'department_ids'    => ['required', 'array', 'min:2'],
            'department_ids.*'  => ['integer', 'distinct',
                Rule::exists('departments', 'id')->where('school_id', $schoolId)],
        ];
    }
}
